package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.GoalType;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class SessionGoalApiTest {

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
    UUID plainTypeId;
    UUID metricTypeId;

    @BeforeEach
    void setup() {
        sessionRepo.deleteAll();
        typeRepo.deleteAll();
        userRepo.deleteAll();

        User user = new User();
        user.setUsername("goal_owner");
        user.setEmail("goal@owner.com");
        user.setPassword("pw");
        user.setCreatedAt(Instant.now());
        userId = userRepo.save(user).getId();

        ActivityType plain = new ActivityType();
        plain.setName("Reading");
        plain.setCustom(false);
        plainTypeId = typeRepo.save(plain).getId();

        ActivityType metric = new ActivityType();
        metric.setName("Chess");
        metric.setCustom(false);
        metric.setMetricKind(MetricKind.INTEGER);
        metric.setMetricLabel("games");
        metricTypeId = typeRepo.save(metric).getId();
    }

    @Test
    void createSession_withTimeGoal_returnsGoalFields() throws Exception {
        String body = json.writeValueAsString(Map.of(
                "activityTypeId", plainTypeId,
                "visibility", "PUBLIC",
                "goalType", GoalType.TIME.name(),
                "goalTarget", 45,
                "goalNote", "finish chapter 3"
        ));

        mvc.perform(post("/api/sessions")
                        .header("X-User-Id", userId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.goalType").value("TIME"))
                .andExpect(jsonPath("$.goalTarget").value(45))
                .andExpect(jsonPath("$.goalNote").value("finish chapter 3"));
    }

    @Test
    void createSession_metricGoal_withoutMetricConfigured_returns400() throws Exception {
        String body = json.writeValueAsString(Map.of(
                "activityTypeId", plainTypeId,
                "visibility", "PUBLIC",
                "goalType", GoalType.METRIC.name(),
                "goalTarget", 10
        ));

        mvc.perform(post("/api/sessions")
                        .header("X-User-Id", userId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateGoal_afterSessionEnded_isAllowed() throws Exception {
        Session session = new Session();
        session.setUser(userRepo.findById(userId).orElseThrow());
        session.setActivityType(typeRepo.findById(plainTypeId).orElseThrow());
        session.setStartedAt(Instant.now().minusSeconds(1200));
        session.setEndedAt(Instant.now().minusSeconds(600));
        session.setVisibility(Visibility.PUBLIC);
        UUID sessionId = sessionRepo.save(session).getId();

        String body = json.writeValueAsString(Map.of(
                "goalType", GoalType.TIME.name(),
                "goalTarget", 30,
                "goalNote", "retrospective goal"
        ));

        mvc.perform(patch("/api/sessions/{id}/goal", sessionId)
                        .header("X-User-Id", userId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalType").value("TIME"))
                .andExpect(jsonPath("$.goalTarget").value(30))
                .andExpect(jsonPath("$.goalNote").value("retrospective goal"));
    }

    @Test
    void stopSession_returnsTimeGoalFeedback() throws Exception {
        Session session = new Session();
        session.setUser(userRepo.findById(userId).orElseThrow());
        session.setActivityType(typeRepo.findById(plainTypeId).orElseThrow());
        session.setStartedAt(Instant.now().minusSeconds(5400));
        session.setVisibility(Visibility.PUBLIC);
        session.setGoalType(GoalType.TIME);
        session.setGoalTarget(new BigDecimal("60"));
        UUID sessionId = sessionRepo.save(session).getId();

        mvc.perform(patch("/api/sessions/{id}/stop", sessionId)
                        .header("X-User-Id", userId.toString())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalType").value("TIME"))
                .andExpect(jsonPath("$.goalDone", greaterThanOrEqualTo(89.0)))
                .andExpect(jsonPath("$.goalAchieved").value(true));
    }

    @Test
    void stopSession_returnsMetricGoalFeedback() throws Exception {
        Session session = new Session();
        session.setUser(userRepo.findById(userId).orElseThrow());
        session.setActivityType(typeRepo.findById(metricTypeId).orElseThrow());
        session.setStartedAt(Instant.now().minusSeconds(600));
        session.setVisibility(Visibility.PUBLIC);
        session.setGoalType(GoalType.METRIC);
        session.setGoalTarget(new BigDecimal("10"));
        UUID sessionId = sessionRepo.save(session).getId();

        String stopBody = json.writeValueAsString(Map.of("metricValue", 12));

        mvc.perform(patch("/api/sessions/{id}/stop", sessionId)
                        .header("X-User-Id", userId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(stopBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalType").value("METRIC"))
                .andExpect(jsonPath("$.goalDone").value(12))
                .andExpect(jsonPath("$.goalAchieved").value(true));
    }
}
