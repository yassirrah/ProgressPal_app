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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class SessionStopApiTest {

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
    @Autowired ObjectMapper json;
    @Autowired UserRepository userRepo;
    @Autowired ActivityTypeRepository typeRepo;
    @Autowired SessionRepository sessionRepo;

    UUID userId;
    UUID typeId;
    UUID sessionId;

    @BeforeEach
    void setup() {
        sessionRepo.deleteAll();
        typeRepo.deleteAll();
        userRepo.deleteAll();

        var u = new User();
        u.setUsername("owner");
        u.setEmail("o@o.com");
        u.setPassword("x");
        u.setCreatedAt(Instant.now());
        userId = userRepo.save(u).getId();

        var t = new ActivityType();
        t.setName("Coding");
        t.setCustom(false);
        typeId = typeRepo.save(t).getId();

        var s = new Session();
        s.setUser(u);
        s.setActivityType(t);
        s.setTitle("Live");
        s.setStartedAt(Instant.now().minusSeconds(600));
        s.setVisibility(Visibility.PUBLIC);
        sessionId = sessionRepo.save(s).getId();
    }

    @Test
    void stop_live_session_returns200_and_sets_endedAt() throws Exception {
        mvc.perform(patch("/api/sessions/{id}/stop", sessionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-User-Id", userId.toString()))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.endedAt").exists());
    }

    @Test
    void stopping_already_stopped_returns409() throws Exception {
        // stop once
        mvc.perform(patch("/api/sessions/{id}/stop", sessionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-User-Id", userId.toString()))
                .andDo(print())
                .andExpect(status().isOk());

        // stop again -> 409
        mvc.perform(patch("/api/sessions/{id}/stop", sessionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-User-Id", userId.toString()))
                .andExpect(status().isConflict());
    }

    @Test
    void stop_notOwner_returns403_standardPayload() throws Exception {

        mvc.perform(patch("/api/sessions/{id}/stop", sessionId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-User-Id", UUID.randomUUID().toString()))
                .andExpect(status().isForbidden());
    }
}
