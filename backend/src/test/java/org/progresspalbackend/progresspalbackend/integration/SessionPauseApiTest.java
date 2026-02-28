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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class SessionPauseApiTest {

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
    @Autowired UserRepository userRepo;
    @Autowired ActivityTypeRepository typeRepo;
    @Autowired SessionRepository sessionRepo;

    UUID ownerId;
    UUID sessionId;

    @BeforeEach
    void setup() {
        sessionRepo.deleteAll();
        typeRepo.deleteAll();
        userRepo.deleteAll();

        User owner = new User();
        owner.setUsername("pause_owner");
        owner.setEmail("pause@owner.com");
        owner.setPassword("pw");
        owner.setCreatedAt(Instant.now());
        ownerId = userRepo.save(owner).getId();

        ActivityType type = new ActivityType();
        type.setName("Coding");
        type.setCustom(false);
        type = typeRepo.save(type);

        Session session = new Session();
        session.setUser(owner);
        session.setActivityType(type);
        session.setStartedAt(Instant.now().minusSeconds(900));
        session.setVisibility(Visibility.PUBLIC);
        sessionId = sessionRepo.save(session).getId();
    }

    @Test
    void pause_live_session_returns200_and_marks_paused() throws Exception {
        mvc.perform(patch("/api/sessions/{id}/pause", sessionId)
                        .header("X-User-Id", ownerId.toString())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paused").value(true))
                .andExpect(jsonPath("$.pausedAt").exists());
    }

    @Test
    void resume_paused_session_returns200_and_accumulates_paused_duration() throws Exception {
        Session session = sessionRepo.findById(sessionId).orElseThrow();
        session.setPausedAt(Instant.now().minusSeconds(90));
        sessionRepo.save(session);

                mvc.perform(patch("/api/sessions/{id}/resume", sessionId)
                        .header("X-User-Id", ownerId.toString())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paused").value(false))
                .andExpect(jsonPath("$.pausedAt").value(nullValue()));

        Session resumed = sessionRepo.findById(sessionId).orElseThrow();
        assertThat(resumed.getPausedDurationSeconds()).isGreaterThanOrEqualTo(90L);
        assertThat(resumed.getPausedAt()).isNull();
    }

    @Test
    void pause_already_paused_session_returns409() throws Exception {
        Session session = sessionRepo.findById(sessionId).orElseThrow();
        session.setPausedAt(Instant.now().minusSeconds(30));
        sessionRepo.save(session);

        mvc.perform(patch("/api/sessions/{id}/pause", sessionId)
                        .header("X-User-Id", ownerId.toString())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isConflict());
    }

    @Test
    void resume_non_paused_session_returns409() throws Exception {
        mvc.perform(patch("/api/sessions/{id}/resume", sessionId)
                        .header("X-User-Id", ownerId.toString())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isConflict());
    }

    @Test
    void pause_non_owner_returns403() throws Exception {
        mvc.perform(patch("/api/sessions/{id}/pause", sessionId)
                        .header("X-User-Id", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }
}
