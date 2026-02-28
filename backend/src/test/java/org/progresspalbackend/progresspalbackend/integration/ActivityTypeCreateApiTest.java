package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.MetricKind;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
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

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ActivityTypeCreateApiTest {

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
    @Autowired UserRepository userRepo;

    @BeforeEach
    void cleanDb() {
        activityTypeRepo.deleteAll();
        userRepo.deleteAll();
    }

    @Test
    void createCustomActivityType_returns201_and_setsCreatedByAndIsCustom() throws Exception {
        User actor = persistUser();

        String body = objectMapper.writeValueAsString(Map.of(
                "name", "My Custom Type",
                "iconUrl", "https://cdn.example.com/icon.png"
        ));

        mvc.perform(post("/api/activity-types")
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.name").value("My Custom Type"))
                // if your response includes these fields, keep them:
                .andExpect(jsonPath("$.createdBy").value(actor.getId().toString()))
                .andExpect(jsonPath("$.custom").value(true))
                .andExpect(jsonPath("$.metricKind").value("NONE"))
                .andExpect(jsonPath("$.metricLabel").doesNotExist());
    }

    @Test
    void createCustomActivityType_withMetric_returnsMetricInResponse() throws Exception {
        User actor = persistUser();

        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Reading",
                "metricKind", MetricKind.INTEGER.name(),
                "metricLabel", "pages"
        ));

        mvc.perform(post("/api/activity-types")
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Reading"))
                .andExpect(jsonPath("$.metricKind").value("INTEGER"))
                .andExpect(jsonPath("$.metricLabel").value("pages"));
    }

    @Test
    void createCustomActivityType_duplicateForSameUser_returns409_standardPayload() throws Exception {
        User actor = persistUser();

        // Pre-insert a custom type with same name for same user
        ActivityType existing = new ActivityType();
        existing.setName("Duplicate Name");
        existing.setCreatedBy(actor); // if your entity uses UUID
        existing.setCustom(true);
        activityTypeRepo.save(existing);

        String body = objectMapper.writeValueAsString(Map.of(
                "name", "Duplicate Name"
        ));

        mvc.perform(post("/api/activity-types")
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.path").value("/api/activity-types"))
                .andExpect(jsonPath("$.message", not(emptyOrNullString())));
    }

    @Test
    void createCustomActivityType_sameNameDifferentUsers_allowed_returns201() throws Exception {
        User u1 = persistUser();
        User u2 = persistUser();

        String body = objectMapper.writeValueAsString(Map.of("name", "Same Name"));

        mvc.perform(post("/api/activity-types")
                        .header("X-User-Id", u1.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/activity-types")
                        .header("X-User-Id", u2.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }

    @Test
    void createCustomActivityType_sameNameAsDefault_allowed_returns201() throws Exception {
        // Default: created_by NULL
        ActivityType defaultType = new ActivityType();
        defaultType.setName("Study");
        defaultType.setCreatedBy(null);  // UUID field nullable (per migration)
        defaultType.setCustom(false);
        activityTypeRepo.save(defaultType);

        User actor = persistUser();

        String body = objectMapper.writeValueAsString(Map.of("name", "Study"));

        mvc.perform(post("/api/activity-types")
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }

    @Test
    void createCustomActivityType_missingAuth_returns401_standardPayload() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", "No Header"));

        mvc.perform(post("/api/activity-types")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.path").value("/api/activity-types"))
                .andExpect(jsonPath("$.message", not(emptyOrNullString())));
    }

    // -------------------------
    // Helpers
    // -------------------------

    private User persistUser() {
        User u = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        u.setUsername("user_" + suffix);
        u.setEmail("user_" + suffix + "@test.com");
        u.setPassword("password_" + suffix);
        return userRepo.save(u);
    }
}
