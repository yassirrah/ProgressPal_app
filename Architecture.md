ProgressPal Architecture & Design Patterns
flowchart LR
A[Controller (Web)] --> B[Service (Application)]
B --> C[Repository (Persistence)]
C --> D[(PostgreSQL)]
B <--> E[Mapper (DTO ↔ Entity)]
E <--> F[Domain Model (User, ActivityType, Session, Visibility)]

High-Level Architecture (Layered)

Web / Controller layer

Spring MVC REST controllers.

HTTP concerns only (routing, status codes, validation, auth principal extraction).

Service / Application layer

Business rules: start/stop session, visibility enforcement, relations resolution.

Orchestrates repositories, sets timestamps, computes derived state.

Repository / Persistence layer

Spring Data JPA repositories (UserRepository, ActivityTypeRepository, SessionRepository).

Encapsulates queries, paging, and data access.

Domain model

Entities: User, ActivityType, Session, Follow.

Value/enum: Visibility { PUBLIC, FOLLOWERS, PRIVATE }.

DTO + Mapper

DTOs decouple API from entities (SessionCreateDto, SessionDto, etc.).

MapStruct mappers convert Entity ↔ DTO to avoid boilerplate.