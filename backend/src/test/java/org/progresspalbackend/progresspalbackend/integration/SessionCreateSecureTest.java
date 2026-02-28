package org.progresspalbackend.progresspalbackend.integration;


import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
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

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import java.util.UUID;

@AutoConfigureMockMvc
@SpringBootTest
@Testcontainers
public class SessionCreateSecureTest {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("ProgressPal")
            .withUsername("Postgres")
            .withPassword("Postgres");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", db::getJdbcUrl);
        r.add("spring.datasource.username", db::getUsername);
        r.add("spring.datasource.password", db::getPassword);
        r.add("spring.flyway.enabled", () -> "true");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired
    UserRepository userRepo;
    @Autowired
    ActivityTypeRepository activityTypeRepo;
    @Autowired
    SessionRepository sessionRepo;

    @BeforeEach
    void cleanDb(){
        sessionRepo.deleteAll();
        activityTypeRepo.deleteAll();
        userRepo.deleteAll();
    }

    @Test
    void createSession_activity_type_not_found_returns404_standardPayload() throws Exception {
        User user = persistUser();

        String body = objectMapper.writeValueAsString(
                Map.of(
                        "activityTypeId", UUID.randomUUID().toString(),
                        "visibility", Visibility.PUBLIC,
                        "title" ,  "t"
                )
        );

        mvc.perform(post("/api/sessions")
                .with(jwt().jwt(jwt -> jwt.subject(user.getId().toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
        ).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.path").value("/api/sessions"))
                .andExpect(jsonPath("$.message").value(containsString("ActivityType not found")));
    }


    @Test
    void createSession_userNotFound_returns404_standardPayload() throws Exception {
        ActivityType type = persistActivityType("Study");

        UUID missingUserId = UUID.randomUUID();

        String body = objectMapper.writeValueAsString(Map.of(
                "activityTypeId", type.getId().toString(),
                "visibility", "PUBLIC",
                "title", "t"
        ));

        mvc.perform(post("/api/sessions")
                        .header("X-User-Id", missingUserId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.path").value("/api/sessions"))
                .andExpect(jsonPath("$.message").value(containsString("User not found")));
    }

    @Test
    void createSession_invalidVisibilityEnum_returns400_standardPayload() throws Exception {
        User user = persistUser();
        ActivityType type = persistActivityType("Study");

        String body = objectMapper.writeValueAsString(Map.of(
                "activityTypeId", type.getId().toString(),
                "visibility", "PUBLIK",
                "title", "t"
        ));

        mvc.perform(post("/api/sessions")
                        .header("X-User-Id", user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.path").value("/api/sessions"))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void createSession_missingAuth_returns401_standardPayload() throws Exception {
        ActivityType type = persistActivityType("Study");

        String body = objectMapper.writeValueAsString(Map.of(
                "activityTypeId", type.getId().toString(),
                "visibility", "PUBLIC",
                "title", "t"
        ));

        mvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.path").value("/api/sessions"))
                .andExpect(jsonPath("$.message").exists());
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
        // set other required fields if your ActivityType has NOT NULL constraints
        return activityTypeRepo.save(t);
    }

}
