package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@Testcontainers
@AutoConfigureMockMvc
public class LiveSessionApiTest {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:13-alpine")
            .withDatabaseName("progresspal")
            .withUsername("postgres")
            .withPassword("postgres");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", db::getJdbcUrl);
        r.add("spring.datasource.username", db::getUsername);
        r.add("spring.datasource.password", db::getPassword);
        r.add("spring.flyway.enabled", () -> "true");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @Autowired SessionRepository sessionRepo;
    @Autowired ActivityTypeRepository activityTypeRepo;
    @Autowired UserRepository userRepo;

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    void cleanDb() {
        // order matters if you have FKs; sessions -> activity types -> users
        sessionRepo.deleteAll();
        activityTypeRepo.deleteAll();
        userRepo.deleteAll();
    }

    @Test
    void live_returns200_when_live_session_exists() throws Exception {
        User u1 = persistUser();
        ActivityType t1 = persistActivityType("Study");

        // ended session (should NOT be returned)
        sessionRepo.save(session(u1, t1, Visibility.PUBLIC,
                Instant.parse("2026-01-01T10:00:00Z"),
                Instant.parse("2026-01-01T11:00:00Z")));

        // live session (should be returned)
        Session live = sessionRepo.save(session(u1, t1, Visibility.PRIVATE,
                Instant.parse("2026-01-02T10:00:00Z"),
                null));

        mockMvc.perform(get("/api/sessions/live")
                        .header("X-User-Id", u1.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(live.getId().toString()))
                .andExpect(jsonPath("$.startedAt").value("2026-01-02T10:00:00Z"))
                .andExpect(jsonPath("$.endedAt").doesNotExist()) // live => endedAt absent (or null depending on serializer)
                .andExpect(jsonPath("$.visibility").value("PRIVATE"))
                // sanity
                .andExpect(jsonPath("$.activityTypeId").exists());
    }

    @Test
    void live_returns204_when_no_live_session() throws Exception {
        User u1 = persistUser();
        ActivityType t1 = persistActivityType("Study");

        // only ended session exists
        sessionRepo.save(session(u1, t1, Visibility.PUBLIC,
                Instant.parse("2026-01-01T10:00:00Z"),
                Instant.parse("2026-01-01T11:00:00Z")));

        mockMvc.perform(get("/api/sessions/live")
                        .header("X-User-Id", u1.getId().toString()))
                .andExpect(status().isNoContent());
    }

    @Test
    void live_returns400_when_header_missing() throws Exception {
        mockMvc.perform(get("/api/sessions/live"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    // ---------- helpers ----------

    private User persistUser() {
        User u = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        u.setUsername("user_" + suffix);
        u.setEmail("user_" + suffix + "@test.com");
        u.setPassword("password_" + suffix);
        return userRepo.save(u);
    }

    private ActivityType persistActivityType(String baseName) {
        ActivityType t = new ActivityType();
        t.setName(baseName + "_" + UUID.randomUUID());
        // if your entity requires visibility/isCustom/createdBy, set them here too
        return activityTypeRepo.save(t);
    }

    private Session session(User user, ActivityType type, Visibility visibility, Instant startedAt, Instant endedAt) {
        Session s = new Session();
        s.setUser(user);
        s.setActivityType(type);
        s.setVisibility(visibility);
        s.setStartedAt(startedAt);
        s.setEndedAt(endedAt);
        s.setTitle("t");
        return s;
    }
}
