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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class FeedPaginationApiTest {

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
    void feed_page0_size2_returnsNewest2PublicSessions() throws Exception {
        User u = persistUser();
        ActivityType t = persistActivityType("Study");

        Session s1 = sessionRepo.save(session(u, t, Visibility.PUBLIC, Instant.parse("2026-01-01T10:00:00Z")));
        Session s2 = sessionRepo.save(session(u, t, Visibility.PUBLIC, Instant.parse("2026-01-02T10:00:00Z")));
        Session s3 = sessionRepo.save(session(u, t, Visibility.PUBLIC, Instant.parse("2026-01-03T10:00:00Z")));

        // Private should never appear
        sessionRepo.save(session(u, t, Visibility.PRIVATE, Instant.parse("2026-01-04T10:00:00Z")));

        mvc.perform(get("/api/feed")
                        .queryParam("page", "0")
                        .queryParam("size", "2")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
//                 sorted startedAt desc -> s3 then s2
                .andExpect(jsonPath("$.content[0].id").value(s3.getId().toString()))
                .andExpect(jsonPath("$.content[1].id").value(s2.getId().toString()))
                .andExpect(jsonPath("$.content[0].visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.content[1].visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(2));
    }

    @Test
    void feed_page1_size2_returnsNextPublicSession() throws Exception {
        User u = persistUser();
        ActivityType t = persistActivityType("Study");

        Session s1 = sessionRepo.save(session(u, t, Visibility.PUBLIC, Instant.parse("2026-01-01T10:00:00Z")));
        sessionRepo.save(session(u, t, Visibility.PUBLIC, Instant.parse("2026-01-02T10:00:00Z")));
        sessionRepo.save(session(u, t, Visibility.PUBLIC, Instant.parse("2026-01-03T10:00:00Z")));

        mvc.perform(get("/api/feed")
                        .queryParam("page", "1")
                        .queryParam("size", "2")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                // page 1 contains the oldest remaining -> s1
                .andExpect(jsonPath("$.content[0].id").value(s1.getId().toString()))
                .andExpect(jsonPath("$.number").value(1))
                .andExpect(jsonPath("$.size").value(2));
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

    private Session session(User user, ActivityType type, Visibility visibility, Instant startedAt) {
        Session s = new Session();
        s.setUser(user);
        s.setActivityType(type);
        s.setVisibility(visibility);
        s.setStartedAt(startedAt);
        s.setEndedAt(null);
        s.setTitle("t");
        return s;
    }
}