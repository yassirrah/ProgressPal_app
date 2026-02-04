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
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class OneLiveSessionApiTest {

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
    void create_whenUserAlreadyHasLiveSession_returns409_standardPayload() throws Exception {
        User user = persistUser();
        ActivityType type = persistActivityType("Study");

        // Existing LIVE session
        Session live = new Session();
        live.setUser(user);
        live.setActivityType(type);
        live.setVisibility(Visibility.PUBLIC);
        live.setTitle("existing");
        live.setStartedAt(Instant.parse("2026-01-01T10:00:00Z"));
        live.setEndedAt(null);
        sessionRepo.save(live);

        // Attempt to create another live session
        String body = objectMapper.writeValueAsString(Map.of(
                "activityTypeId", type.getId().toString(),
                "visibility", "PUBLIC",
                "title", "new attempt"
        ));

        mvc.perform(post("/api/sessions")
                        .header("X-User-Id", user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.path").value("/api/sessions"))
                .andExpect(jsonPath("$.message").value(containsString("User already has a live session")))
        ;
    }

    @Test
    void create_whenPreviousSessionEnded_allowsNewSession_returns201() throws Exception {
        User user = persistUser();
        ActivityType type = persistActivityType("Study");

        // Existing ENDED session
        Session ended = new Session();
        ended.setUser(user);
        ended.setActivityType(type);
        ended.setVisibility(Visibility.PUBLIC);
        ended.setTitle("ended");
        ended.setStartedAt(Instant.parse("2026-01-01T10:00:00Z"));
        ended.setEndedAt(Instant.parse("2026-01-01T11:00:00Z"));
        sessionRepo.save(ended);

        String body = objectMapper.writeValueAsString(Map.of(
                "activityTypeId", type.getId().toString(),
                "visibility", "PUBLIC",
                "title", "new session"
        ));

        mvc.perform(post("/api/sessions")
                        .header("X-User-Id", user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id").value(notNullValue()))
                .andExpect(jsonPath("$.userId").value(user.getId().toString()))
                .andExpect(jsonPath("$.activityTypeId").value(type.getId().toString()))
                .andExpect(jsonPath("$.endedAt").isEmpty()); // live => null
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

    private ActivityType persistActivityType(String base) {
        ActivityType t = new ActivityType();
        t.setName(base + "_" + UUID.randomUUID());
        // If ActivityType has required flags like isCustom, set them here:
        // t.setIsCustom(false);
        // t.setCreatedBy(null);
        return activityTypeRepo.save(t);
    }
}