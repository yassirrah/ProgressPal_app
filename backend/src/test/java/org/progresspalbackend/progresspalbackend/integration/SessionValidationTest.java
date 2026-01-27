package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.junit.Before;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.dto.session.SessionCreateDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionDto;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springdoc.webmvc.core.service.RequestService;
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
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
@AutoConfigureMockMvc
@SpringBootTest
public class SessionValidationTest {
    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:13-alpine")
            .withDatabaseName("progresspal")
            .withUsername("progress")
            .withPassword("progress");
    @Autowired
    private RequestService requestBuilder;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", db::getJdbcUrl);
        registry.add("spring.datasource.password", db::getPassword);
        registry.add("spring.datasource.username", db::getUsername);
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired SessionRepository sessionRepository;
    @Autowired ActivityTypeRepository activityTypeRepository;
    @Autowired UserRepository userRepository;

    @BeforeEach
    void cleanDb(){
        sessionRepository.deleteAll();
    }

    @Test
    void startSession_missingActivityTypeId_returns400_withStandardPayload() throws Exception {
        UUID actor_id = UUID.randomUUID();
        String body = json.writeValueAsString(
                Map.of("Visibility", "PUBLIC")
        );

        mvc.perform(post("/api/sessions")
                .header("X-User-Id", actor_id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.path").value("/api/sessions"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("activityTypeId is required.")));
    }

    @Test
    void startSession_missingVisibility_returns400_withStandardPayload() throws Exception {
        UUID actorUserId = UUID.randomUUID();

        // missing visibility
        String body = json.writeValueAsString(Map.of(
                "activityTypeId", UUID.randomUUID().toString()
        ));

        mvc.perform(post("/api/sessions")
                        .header("X-User-Id", actorUserId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.path").value("/api/sessions"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("visibility is required.")));
    }

    @Test
    void startSession_titleTooLong_returns400_withStandardPayload() throws Exception {
        UUID actorUserId = UUID.randomUUID();

        String longTitle = "x".repeat(121);

        String body = json.writeValueAsString(Map.of(
                "activityTypeId", UUID.randomUUID().toString(),
                "visibility", "PUBLIC",
                "title", longTitle
        ));

        mvc.perform(post("/api/sessions")
                        .header("X-User-Id", actorUserId.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.path").value("/api/sessions"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("title must be at most 120 characters.")));
    }

}
