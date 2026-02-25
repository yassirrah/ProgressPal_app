package org.progresspalbackend.progresspalbackend.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class MeSessionsApiTest {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:13-alpine")
            .withDatabaseName("progresspal")
            .withUsername("progress")
            .withPassword("progress");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", db::getJdbcUrl);
        registry.add("spring.datasource.username", db::getUsername);
        registry.add("spring.datasource.password", db::getPassword);
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @Autowired MockMvc mvc;
    @Autowired SessionRepository sessionRepo;
    @Autowired ActivityTypeRepository activityTypeRepo;
    @Autowired UserRepository userRepo;

    @BeforeEach
    void cleanDb() {
        sessionRepo.deleteAll();
        activityTypeRepo.deleteAll();
        userRepo.deleteAll();
    }

    @Test
    void meSessions_returnsOnlyHeaderUserSessions_sortedByStartedAtDesc() throws Exception {
        User me = persistUser();
        User other = persistUser();
        ActivityType type = persistActivityType("Study");

        Session oldestMine = sessionRepo.save(session(me, type, Visibility.PUBLIC, Instant.parse("2026-01-01T10:00:00Z"), true));
        Session newestMine = sessionRepo.save(session(me, type, Visibility.PRIVATE, Instant.parse("2026-01-03T10:00:00Z"), true));
        sessionRepo.save(session(other, type, Visibility.PUBLIC, Instant.parse("2026-01-04T10:00:00Z"), true));

        mvc.perform(get("/api/me/sessions")
                        .header("X-User-Id", me.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].id").value(newestMine.getId().toString()))
                .andExpect(jsonPath("$.content[1].id").value(oldestMine.getId().toString()))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void meSessions_supportsCombinedFilters_dateRange_activityType_visibility_andEndedStatus() throws Exception {
        User me = persistUser();
        User other = persistUser();
        ActivityType chess = persistActivityType("Chess");
        ActivityType reading = persistActivityType("Reading");

        Session match = sessionRepo.save(session(me, chess, Visibility.PRIVATE, Instant.parse("2026-01-03T09:00:00Z"), true));
        sessionRepo.save(session(other, chess, Visibility.PRIVATE, Instant.parse("2026-01-03T09:00:00Z"), true)); // other user
        sessionRepo.save(session(me, reading, Visibility.PRIVATE, Instant.parse("2026-01-03T09:00:00Z"), true)); // other type
        sessionRepo.save(session(me, chess, Visibility.PUBLIC, Instant.parse("2026-01-03T09:00:00Z"), true)); // other visibility
        sessionRepo.save(session(me, chess, Visibility.PRIVATE, Instant.parse("2026-01-03T09:00:00Z"), false)); // live
        sessionRepo.save(session(me, chess, Visibility.PRIVATE, Instant.parse("2026-01-05T09:00:00Z"), true)); // out of range

        mvc.perform(get("/api/me/sessions")
                        .header("X-User-Id", me.getId().toString())
                        .queryParam("from", "2026-01-02")
                        .queryParam("to", "2026-01-03")
                        .queryParam("activityTypeId", chess.getId().toString())
                        .queryParam("visibility", "PRIVATE")
                        .queryParam("status", "ENDED")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(match.getId().toString()))
                .andExpect(jsonPath("$.content[0].visibility").value("PRIVATE"))
                .andExpect(jsonPath("$.content[0].endedAt").exists());
    }

    @Test
    void meSessions_statusLive_returnsOnlyLiveSessions() throws Exception {
        User me = persistUser();
        ActivityType type = persistActivityType("Gym");

        Session live = sessionRepo.save(session(me, type, Visibility.PUBLIC, Instant.parse("2026-01-04T08:00:00Z"), false));
        sessionRepo.save(session(me, type, Visibility.PUBLIC, Instant.parse("2026-01-04T07:00:00Z"), true));

        mvc.perform(get("/api/me/sessions")
                        .header("X-User-Id", me.getId().toString())
                        .queryParam("status", "LIVE")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(live.getId().toString()))
                .andExpect(jsonPath("$.content[0].endedAt").doesNotExist());
    }

    @Test
    void meSessions_clampsPageSize_toMax() throws Exception {
        User me = persistUser();
        ActivityType type = persistActivityType("Reading");

        for (int i = 0; i < 3; i++) {
            sessionRepo.save(session(me, type, Visibility.PUBLIC, Instant.parse("2026-01-0" + (i + 1) + "T10:00:00Z"), true));
        }

        mvc.perform(get("/api/me/sessions")
                        .header("X-User-Id", me.getId().toString())
                        .queryParam("page", "0")
                        .queryParam("size", "999")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    private User persistUser() {
        User u = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        u.setUsername("user_" + suffix);
        u.setEmail("user_" + suffix + "@test.com");
        u.setPassword("password_" + suffix);
        return userRepo.save(u);
    }

    private ActivityType persistActivityType(String base) {
        ActivityType t = new ActivityType();
        t.setName(base + "_" + UUID.randomUUID());
        return activityTypeRepo.save(t);
    }

    private Session session(User user, ActivityType type, Visibility visibility, Instant startedAt, boolean ended) {
        Session s = new Session();
        s.setUser(user);
        s.setActivityType(type);
        s.setVisibility(visibility);
        s.setStartedAt(startedAt);
        s.setEndedAt(ended ? startedAt.plusSeconds(600) : null);
        s.setTitle("t");
        return s;
    }
}
