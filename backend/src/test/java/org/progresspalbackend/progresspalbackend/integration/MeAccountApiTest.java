package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class MeAccountApiTest {

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
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void cleanDb() {
        userRepo.deleteAll();
    }

    @Test
    void meAccount_get_returnsCurrentUser() throws Exception {
        User user = persistUser("me_user", "me@test.com", "pw123");
        user.setBio("focus");
        user.setProfileImage("https://img.example/avatar.png");
        userRepo.save(user);

        mvc.perform(get("/api/me/account")
                        .header("X-User-Id", user.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(user.getId().toString()))
                .andExpect(jsonPath("$.username").value("me_user"))
                .andExpect(jsonPath("$.email").value("me@test.com"))
                .andExpect(jsonPath("$.bio").value("focus"))
                .andExpect(jsonPath("$.profileImage").value("https://img.example/avatar.png"));
    }

    @Test
    void meAccount_patch_updatesProfileFields() throws Exception {
        User user = persistUser("old_name", "old@test.com", "pw123");

        String payload = json.writeValueAsString(Map.of(
                "username", "new_name",
                "email", "new@test.com",
                "bio", "new bio",
                "profileImage", "https://img.example/new.png"
        ));

        mvc.perform(patch("/api/me/account")
                        .header("X-User-Id", user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("new_name"))
                .andExpect(jsonPath("$.email").value("new@test.com"))
                .andExpect(jsonPath("$.bio").value("new bio"))
                .andExpect(jsonPath("$.profileImage").value("https://img.example/new.png"));

        User updated = userRepo.findById(user.getId()).orElseThrow();
        assertThat(updated.getUsername()).isEqualTo("new_name");
        assertThat(updated.getEmail()).isEqualTo("new@test.com");
        assertThat(updated.getBio()).isEqualTo("new bio");
        assertThat(updated.getProfileImage()).isEqualTo("https://img.example/new.png");
        assertThat(updated.getUpdatedAt()).isNotNull();
    }

    @Test
    void meAccount_patch_password_withWrongCurrentPassword_returns403() throws Exception {
        User user = persistUser("secure_user", "secure@test.com", "pw123");

        String payload = json.writeValueAsString(Map.of(
                "currentPassword", "wrong-current",
                "newPassword", "new-pass-123"
        ));

        mvc.perform(patch("/api/me/account")
                        .header("X-User-Id", user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isForbidden());
    }

    @Test
    void meAccount_patch_password_withoutCurrentPassword_returns400() throws Exception {
        User user = persistUser("secure_user2", "secure2@test.com", "pw123");

        String payload = json.writeValueAsString(Map.of(
                "newPassword", "new-pass-123"
        ));

        mvc.perform(patch("/api/me/account")
                        .header("X-User-Id", user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());
    }

    @Test
    void meAccount_patch_username_conflict_returns409() throws Exception {
        User first = persistUser("first_user", "first@test.com", "pw123");
        persistUser("taken_name", "taken@test.com", "pw123");

        String payload = json.writeValueAsString(Map.of(
                "username", "taken_name"
        ));

        mvc.perform(patch("/api/me/account")
                        .header("X-User-Id", first.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict());
    }

    @Test
    void meAccount_patch_password_withValidCurrentPassword_updatesPassword() throws Exception {
        User user = persistUser("secure_user3", "secure3@test.com", "pw123");

        String payload = json.writeValueAsString(Map.of(
                "currentPassword", "pw123",
                "newPassword", "next-strong-pass"
        ));

        mvc.perform(patch("/api/me/account")
                        .header("X-User-Id", user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk());

        User updated = userRepo.findById(user.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("next-strong-pass", updated.getPassword())).isTrue();
    }

    @Test
    void meAccount_patch_password_forKeycloakLinkedAccount_returns400() throws Exception {
        User user = persistUser("kc_user", "kc@test.com", "pw123");
        user.setAuthProvider("KEYCLOAK");
        user.setAuthIssuer("http://localhost:8081/realms/progresspal");
        user.setAuthSubject("keycloak-subject");
        userRepo.save(user);

        String payload = json.writeValueAsString(Map.of(
                "currentPassword", "pw123",
                "newPassword", "next-strong-pass"
        ));

        mvc.perform(patch("/api/me/account")
                        .header("X-User-Id", user.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("password changes are disabled for Keycloak-linked accounts"));
    }

    private User persistUser(String username, String email, String rawPassword) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setCreatedAt(Instant.now());
        return userRepo.save(user);
    }
}
