# 로컬 MySQL / Redis 연결 복구

## 확인 결과 (2026-10-12)

- `.env`: MySQL `localhost:3306`, DB 이름 `stockmate`; Redis `localhost:6379`.
- MySQL80 서비스는 실행 중이며 실제 서버는 `WIN-BNUTVS2DD4V:3306`이다.
- 현재 계정의 `SHOW DATABASES` 결과: `information_schema`, `mysql`, `performance_schema`, `sakila`, `sys`, `world`. `stockmate`는 없으며 선택 시 `ER_BAD_DB_ERROR`가 발생한다.
- Redis 6379와 백엔드 3000은 TCP 연결 거부 상태이다.
- TypeORM `synchronize: false`는 유지한다. SQL 덤프 실행, 마이그레이션, DB 생성/삭제/초기화는 수행하지 않았다.
- `stockmate.sql`, `db/stockmate_backup_20260814.sql`, `db/stockmate_backup_20260827.sql`은 백업 후보이며 현재 운영 데이터라는 보장은 없다. 자동 복원하지 않는다.

## MySQL: 기존 서버부터 찾기

기존 StockMate 데이터가 있는 MySQL의 주소, 노출 포트, DB 이름을 확인한 다음 `.env`의 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`를 해당 값으로 수정한다. 예제 DB인 `sakila`, `world`로 바꾸지 않는다.

Docker를 사용했던 환경에서는 다음 읽기 전용 명령으로 기존 컨테이너와 볼륨을 찾는다.

```powershell
docker ps -a
docker volume ls
docker inspect <기존-MySQL-컨테이너명> --format '{{json .Mounts}}'
docker port <기존-MySQL-컨테이너명>
```

기존 컨테이너가 중지되어 있다면 볼륨 연결을 확인한 뒤 `docker start <기존-MySQL-컨테이너명>`으로 재개한다. `docker compose down -v`, 볼륨 삭제, 새 MySQL 컨테이너로 기존 볼륨 덮어쓰기는 하지 않는다.

현재 PC에는 Docker CLI가 PATH에서 발견되지 않았다. 기존 서버가 다른 PC/배포 서버라면 해당 환경에서 확인해야 한다. 기존 서버를 찾지 못하면 빈 DB 생성만으로는 테이블과 데이터를 복구할 수 없다. 새 DB 생성 및 백업 복원은 별도 승인과 백업 검토 후 진행한다.

## Redis 실행

기존 Redis가 있다면 그 서비스를 재개하고 `.env`의 `REDIS_HOST`, `REDIS_PORT`를 실제 주소와 포트로 맞춘다. `localhost`는 백엔드가 실행되는 환경 자신을 가리킨다.

Docker 설치/실행 후 기존 Redis 컨테이너가 있다면 우선 `docker start <기존-Redis-컨테이너명>`을 사용한다. 기존 Redis가 없고 새 로컬 Redis가 필요한 경우에만 다음을 실행한다.

```powershell
docker run -d --name stockmate-redis-local --restart unless-stopped -p 127.0.0.1:6379:6379 -v stockmate-redis-local-data:/data redis:7-alpine redis-server --appendonly yes
docker exec stockmate-redis-local redis-cli PING
```

응답은 `PONG`이어야 한다. 위 명령은 새 Redis와 전용 볼륨을 생성하며 이 작업에서는 실행하지 않았다.

## 로컬과 Docker 설정 구분

- 로컬 `npm.cmd run start:dev`는 기본적으로 `.env`를 읽는다.
- Docker 이미지에는 `.env` 파일이 복사되지 않는다. `.env.docker`는 `docker run --env-file .env.docker ...`로 명시해야 한다.
- `.env.docker`의 `host.docker.internal`은 Docker Desktop에서 호스트 PC 서비스를 가리킨다. 다른 컨테이너의 DB/Redis에 연결한다면 같은 네트워크의 실제 컨테이너 이름과 내부 포트를 사용한다.
- 배포 워크플로는 Linux 서버의 `/opt/stockmate/.env`를 주입한다. 로컬 `.env.docker` 수정은 이 배포 설정에 반영되지 않는다.
- 배포 포트는 `127.0.0.1:3000:3000`이므로 원격 브라우저에서는 배포 서버의 프록시 주소를 사용해야 한다.

## 재검증

PowerShell 실행 정책을 변경하지 않고 `npm.cmd`를 사용한다.

```powershell
npm.cmd run check:connections
npm.cmd run build
npm.cmd run start:prod
```

진단은 DB 목록/테이블 조회와 Redis PING만 수행한다. 두 연결이 성공해야 기동 검증을 진행할 수 있다. 실제 빌드 출력은 `dist/src/main.js`이므로 `start:prod`를 이 경로로 수정했다.

다른 터미널에서 다음을 실행한다. 빈 요청은 데이터 변경 없이 HTTP 400을 기대한다.

```powershell
curl.exe -i http://localhost:3000/api
curl.exe -i -X POST http://localhost:3000/users/login -H "Content-Type: application/json" -d '{}'
curl.exe -i -X POST http://localhost:3000/users/google-login -H "Content-Type: application/json" -d '{}'
```

일반 로그인 성공은 실제 계정/암호가, Google 로그인 성공은 설정된 `GOOGLE_CLIENT_ID`에 발급된 유효한 `idToken`이 필요하다. 토큰을 로그나 저장소에 남기지 않는다. 로그인 성공은 Redis에 refresh token을 기록하며 Google 로그인은 계정을 생성/연결할 수 있다.

프론트 기본 API 주소는 `http://localhost:3000`이고 로그인 경로는 백엔드와 일치한다. 백엔드가 해당 포트에서 기동하기 전에는 두 요청 모두 `ERR_CONNECTION_REFUSED`가 발생한다.
