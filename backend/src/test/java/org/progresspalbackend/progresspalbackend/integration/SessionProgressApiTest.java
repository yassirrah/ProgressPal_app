package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.MetricKind;
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
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class SessionProgressApiTest {

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

    UUID ownerId;
    UUID metricSessionId;
    UUID nonMetricSessionId;

    @BeforeEach
    void setup() {
        sessionRepo.deleteAll();
        typeRepo.deleteAll();
        userRepo.deleteAll();

        User owner = new User();
        owner.setUsername("progress_owner");
        owner.setEmail("progress@owner.com");
        owner.setPassword("pw");
        owner.setCreatedAt(Instant.now());
        ownerId = userRepo.save(owner).getId();

        ActivityType metricType = new ActivityType();
        metricType.setName("Chess");
        metricType.setCustom(false);
        metricType.setMetricKind(MetricKind.INTEGER);
        metricType.setMetricLabel("games");
        metricType = typeRepo.save(metricType);

        ActivityType noMetricType = new ActivityType();
        noMetricType.setName("Reading");
        noMetricType.setCustom(false);
        noMetricType = typeRepo.save(noMetricType);

        Session metricSession = new Session();
        metricSession.setUser(owner);
        metricSession.setActivityType(metricType);
        metricSession.setStartedAt(Instant.now().minusSeconds(900));
        metricSession.setVisibility(Visibility.PUBLIC);
        metricSessionId = sessionRepo.save(metricSession).getId();

        Session nonMetricSession = new Session();
        nonMetricSession.setUser(owner);
        nonMetricSession.setActivityType(noMetricType);
        nonMetricSession.setStartedAt(Instant.now().minusSeconds(900));
        nonMetricSession.setVisibility(Visibility.PUBLIC);
        nonMetricSessionId = sessionRepo.save(nonMetricSession).getId();
    }

    @Test
    void updateProgress_onLiveMetricSession_returns200_and_setsMetricCurrentValue() throws Exception {
        String body = json.writeValueAsString(Map.of("metricCurrentValue", 4));

        mvc.perform(patch("/api/sessions/{id}/progress", metricSessionId)
                        .header("X-User-Id", ownerId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metricCurrentValue").value(4))
                .andExpect(jsonPath("$.goalDone").value(4));
    }

    @Test
    void updateProgress_onNonMetricActivity_returns400() throws Exception {
        String body = json.writeValueAsString(Map.of("metricCurrentValue", 2));

        mvc.perform(patch("/api/sessions/{id}/progress", nonMetricSessionId)
                        .header("X-User-Id", ownerId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateProgress_onStoppedSession_returns409() throws Exception {
        Session stopped = sessionRepo.findById(metricSessionId).orElseThrow();
        stopped.setEndedAt(Instant.now());
        sessionRepo.save(stopped);

        String body = json.writeValueAsString(Map.of("metricCurrentValue", 3));

        mvc.perform(patch("/api/sessions/{id}/progress", metricSessionId)
                        .header("X-User-Id", ownerId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void updateProgress_onPausedSession_returns409() throws Exception {
        Session paused = sessionRepo.findById(metricSessionId).orElseThrow();
        paused.setPausedAt(Instant.now().minusSeconds(30));
        sessionRepo.save(paused);

        String body = json.writeValueAsString(Map.of("metricCurrentValue", 3));

        mvc.perform(patch("/api/sessions/{id}/progress", metricSessionId)
                        .header("X-User-Id", ownerId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }
}
