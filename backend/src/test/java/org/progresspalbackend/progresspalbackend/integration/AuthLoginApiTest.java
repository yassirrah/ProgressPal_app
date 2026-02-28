package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AuthLoginApiTest {

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

    User persistedUser;

    @BeforeEach
    void setup() {
        userRepo.deleteAll();

        User user = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        user.setUsername("auth_" + suffix);
        user.setEmail("auth_" + suffix + "@test.com");
        user.setPassword("pw123");
        user.setCreatedAt(Instant.now());
        persistedUser = userRepo.save(user);
    }

    @Test
    void login_validCredentials_returnsTokenAndUser_andTokenCanAccessProtectedRoute() throws Exception {
        String requestBody = json.writeValueAsString(Map.of(
                "email", persistedUser.getEmail(),
                "password", "pw123"
        ));

        MvcResult loginResult = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.user.id").value(persistedUser.getId().toString()))
                .andExpect(jsonPath("$.user.email").value(persistedUser.getEmail()))
                .andReturn();

        JsonNode body = json.readTree(loginResult.getResponse().getContentAsString());
        String token = body.get("token").asText();

        mvc.perform(get("/api/sessions/live")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    void login_invalidPassword_returns401() throws Exception {
        String requestBody = json.writeValueAsString(Map.of(
                "email", persistedUser.getEmail(),
                "password", "wrong"
        ));

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value(containsString("Invalid credentials")));
    }

    @Test
    void login_unknownEmail_returns401() throws Exception {
        String requestBody = json.writeValueAsString(Map.of(
                "email", "missing@test.com",
                "password", "pw123"
        ));

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value(containsString("Invalid credentials")));
    }
}
