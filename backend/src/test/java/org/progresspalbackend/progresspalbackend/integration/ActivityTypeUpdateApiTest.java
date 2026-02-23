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

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ActivityTypeUpdateApiTest {

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
    @Autowired ObjectMapper objectMapper;
    @Autowired ActivityTypeRepository activityTypeRepo;
    @Autowired SessionRepository sessionRepo;
    @Autowired UserRepository userRepo;

    @BeforeEach
    void cleanDb() {
        sessionRepo.deleteAll();
        activityTypeRepo.deleteAll();
        userRepo.deleteAll();
    }

    @Test
    void update_metric_when_activity_type_already_used_returns409() throws Exception {
        ActivityType type = persistType("Reading", MetricKind.INTEGER, "pages");
        persistSession(type);

        String body = objectMapper.writeValueAsString(Map.of(
                "name", type.getName(),
                "iconUrl", "https://cdn.example.com/reading.png",
                "metricKind", MetricKind.DECIMAL.name(),
                "metricLabel", "km"
        ));

        mvc.perform(put("/api/activity-types/{id}", type.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message", containsString("cannot be changed once used")));
    }

    @Test
    void update_non_metric_fields_when_activity_type_already_used_is_allowed() throws Exception {
        ActivityType type = persistType("Reading", MetricKind.INTEGER, "pages");
        persistSession(type);

        String renamed = "Reading Focused " + UUID.randomUUID();
        String body = objectMapper.writeValueAsString(Map.of(
                "name", renamed,
                "iconUrl", "https://cdn.example.com/reading2.png",
                "metricKind", MetricKind.INTEGER.name(),
                "metricLabel", "pages"
        ));

        mvc.perform(put("/api/activity-types/{id}", type.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(renamed))
                .andExpect(jsonPath("$.metricKind").value("INTEGER"))
                .andExpect(jsonPath("$.metricLabel").value("pages"));
    }

    private ActivityType persistType(String baseName, MetricKind metricKind, String metricLabel) {
        ActivityType t = new ActivityType();
        t.setName(baseName + "_" + UUID.randomUUID());
        t.setCustom(false);
        t.setMetricKind(metricKind);
        t.setMetricLabel(metricLabel);
        return activityTypeRepo.save(t);
    }

    private void persistSession(ActivityType type) {
        User u = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        u.setUsername("u_" + suffix);
        u.setEmail("u_" + suffix + "@test.com");
        u.setPassword("x");
        u = userRepo.save(u);

        Session s = new Session();
        s.setUser(u);
        s.setActivityType(type);
        s.setTitle("Used session");
        s.setStartedAt(Instant.now().minusSeconds(120));
        s.setVisibility(Visibility.PUBLIC);
        sessionRepo.save(s);
    }
}
