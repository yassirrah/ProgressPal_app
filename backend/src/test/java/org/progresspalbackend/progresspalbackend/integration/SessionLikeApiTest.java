package org.progresspalbackend.progresspalbackend.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionReactionRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Testcontainers
@AutoConfigureMockMvc
class SessionLikeApiTest {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:13-alpine")
            .withDatabaseName("progresspal")
            .withUsername("progress")
            .withPassword("progress");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", db::getJdbcUrl);
        r.add("spring.datasource.username", db::getUsername);
        r.add("spring.datasource.password", db::getPassword);
        r.add("spring.flyway.enabled", () -> "true");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    SessionReactionRepository reactionRepository;

    @Autowired
    SessionRepository sessionRepository;

    @Autowired
    ActivityTypeRepository activityTypeRepository;

    @Autowired
    FriendRepository friendRepository;

    @Autowired
    UserRepository userRepository;

    @BeforeEach
    void cleanDb() {
        reactionRepository.deleteAll();
        sessionRepository.deleteAll();
        friendRepository.deleteAll();
        activityTypeRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void likeAndUnlikeSession_updatesSummary() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Gym");
        Session session = persistSession(owner, type, Visibility.PUBLIC);

        mvc.perform(get("/api/sessions/{sessionId}/likes", session.getId())
                        .header("X-User-Id", actor.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likesCount").value(0))
                .andExpect(jsonPath("$.likedByMe").value(false));

        mvc.perform(put("/api/sessions/{sessionId}/likes", session.getId())
                        .header("X-User-Id", actor.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likesCount").value(1))
                .andExpect(jsonPath("$.likedByMe").value(true));

        mvc.perform(put("/api/sessions/{sessionId}/likes", session.getId())
                        .header("X-User-Id", actor.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likesCount").value(1))
                .andExpect(jsonPath("$.likedByMe").value(true));

        mvc.perform(delete("/api/sessions/{sessionId}/likes", session.getId())
                        .header("X-User-Id", actor.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likesCount").value(0))
                .andExpect(jsonPath("$.likedByMe").value(false));
    }

    @Test
    void likePrivateSession_byNonOwner_returns403() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PRIVATE);

        mvc.perform(put("/api/sessions/{sessionId}/likes", session.getId())
                        .header("X-User-Id", actor.getId().toString()))
                .andExpect(status().isForbidden());
    }

    private User persistUser() {
        User user = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        user.setUsername("user_" + suffix);
        user.setEmail("user_" + suffix + "@test.com");
        user.setPassword("password_" + suffix);
        return userRepository.save(user);
    }

    private ActivityType persistActivityType(String baseName) {
        ActivityType type = new ActivityType();
        type.setName(baseName + "_" + UUID.randomUUID());
        return activityTypeRepository.save(type);
    }

    private Session persistSession(User owner, ActivityType type, Visibility visibility) {
        Session session = new Session();
        session.setUser(owner);
        session.setActivityType(type);
        session.setVisibility(visibility);
        session.setStartedAt(Instant.parse("2026-01-01T10:00:00Z"));
        session.setEndedAt(null);
        session.setTitle("focus");
        return sessionRepository.save(session);
    }
}
