progresspal/
├─ .editorconfig
├─ .gitattributes
├─ .gitignore
├─ README.md
├─ infra/
│  ├─ docker-compose.dev.yml
│  └─ env/
│     ├─ api.dev.env.example
│     └─ web.dev.env.example
├─ .github/
│  └─ workflows/
│     └─ ci.yml
├─ backend/                       # Spring Boot (Maven)
│  ├─ mvnw
│  ├─ mvnw.cmd
│  ├─ pom.xml
│  └─ src/
│     ├─ main/
│     │  ├─ java/com/progresspal/
│     │  │  ├─ ProgressPalApplication.java
│     │  │  ├─ config/
│     │  │  │  ├─ OpenApiConfig.java
│     │  │  │  └─ SecurityConfig.java          # JWT later; allow-all in dev
│     │  │  ├─ domain/
│     │  │  │  ├─ user/User.java
│     │  │  │  ├─ activity/ActivityType.java
│     │  │  │  ├─ session/Session.java
│     │  │  │  └─ social/Follow.java
│     │  │  ├─ dto/
│     │  │  │  ├─ user/{UserCreateDto.java,UserDto.java,SimpleUserDto.java}
│     │  │  │  ├─ activitytype/{ActivityTypeCreateDto.java,ActivityTypeDto.java}
│     │  │  │  └─ session/{SessionCreateDto.java,SessionDto.java,Visibility.java,PagedResponse.java}
│     │  │  ├─ mapper/
│     │  │  │  ├─ UserMapper.java
│     │  │  │  ├─ ActivityTypeMapper.java
│     │  │  │  └─ SessionMapper.java
│     │  │  ├─ repository/
│     │  │  │  ├─ user/UserRepository.java
│     │  │  │  ├─ activity/ActivityTypeRepository.java
│     │  │  │  ├─ session/SessionRepository.java
│     │  │  │  └─ social/FollowRepository.java
│     │  │  ├─ service/
│     │  │  │  ├─ user/UserService.java
│     │  │  │  ├─ activity/ActivityTypeService.java
│     │  │  │  ├─ session/SessionService.java
│     │  │  │  └─ social/FollowService.java
│     │  │  ├─ web/                       # REST controllers
│     │  │  │  ├─ user/UserController.java
│     │  │  │  ├─ activity/ActivityTypeController.java
│     │  │  │  ├─ session/SessionController.java
│     │  │  │  └─ social/FollowController.java
│     │  │  ├─ exception/
│     │  │  │  ├─ ApiExceptionHandler.java      # @ControllerAdvice → error envelope
│     │  │  │  └─ NotFoundException.java
│     │  │  └─ util/
│     │  │     └─ DateTimeUtils.java
│     │  └─ resources/
│     │     ├─ application.yml
│     │     ├─ application-dev.yml
│     │     ├─ application-prod.yml
│     │     └─ db/migration/                  # Flyway
│     │        ├─ V1__init_users_activity_types.sql
│     │        ├─ V2__sessions_and_follows.sql
│     │        └─ V3__seed_defaults.sql
│     └─ test/java/com/progresspal/
│        ├─ BaseIntegrationTest.java          # Testcontainers Postgres
│        └─ session/SessionRepositoryTest.java
├─ frontend/                     # React + Vite + React Query (+ Zustand if you like)
│  ├─ package.json
│  ├─ index.html
│  ├─ vite.config.ts
│  └─ src/
│     ├─ main.tsx
│     ├─ app/
│     │  ├─ routes.tsx
│     │  └─ providers.tsx
│     ├─ features/
│     │  ├─ auth/       { LoginPage.tsx, RegisterPage.tsx, api.ts, store.ts }
│     │  ├─ activityTypes/ { list.tsx, create.tsx, api.ts }
│     │  ├─ sessions/   { start.tsx, liveBanner.tsx, api.ts }
│     │  ├─ feed/       { FeedPage.tsx, LiveNow.tsx, api.ts }
│     │  ├─ leaderboard/{ LeaderboardPage.tsx, api.ts }
│     │  └─ history/    { HistoryPage.tsx, api.ts }
│     ├─ components/    { Button.tsx, Card.tsx, Loader.tsx, EmptyState.tsx }
│     ├─ lib/           { http.ts (axios/fetch), query.ts, time.ts }
│     └─ styles/        { globals.css }
