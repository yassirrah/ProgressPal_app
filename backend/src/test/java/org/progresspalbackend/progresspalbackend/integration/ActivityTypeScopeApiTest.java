package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
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

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@Testcontainers
@AutoConfigureMockMvc
public class ActivityTypeScopeApiTest {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:13-alpine")
            .withDatabaseName("progresspal")
            .withUsername("postgres")
            .withPassword("postgres");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", db::getJdbcUrl);
        r.add("spring.datasource.username", db::getUsername);
        r.add("spring.datasource.password", db::getPassword);
        r.add("spring.flyway.enabled", () -> "true");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @Autowired ActivityTypeRepository activityTypeRepo;
    @Autowired UserRepository userRepo;

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    void cleanDb() {
        activityTypeRepo.deleteAll();
        userRepo.deleteAll();
    }

    // ---------------- LIST TESTS ----------------

    @Test
    void list_scope_DEFAULTS_returns_only_defaults() throws Exception {
        User u1 = persistUser();
        User u2 = persistUser();

        persistDefaultType("Study");
        persistDefaultType("Gym");

        persistCustomType(u1, "Chess");
        persistCustomType(u2, "Reading");

        mockMvc.perform(get("/api/activity-types")
                        .header("X-User-Id", u1.getId().toString())
                        .queryParam("scope", "DEFAULTS")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].custom").value(false))
                .andExpect(jsonPath("$[1].custom").value(false));
    }

    @Test
    void list_scope_MINE_returns_only_my_custom_types() throws Exception {
        User u1 = persistUser();
        User u2 = persistUser();

        persistDefaultType("Study");
        persistCustomType(u1, "Chess");
        persistCustomType(u1, "Meditation");
        persistCustomType(u2, "Reading");

        mockMvc.perform(get("/api/activity-types")
                        .header("X-User-Id", u1.getId().toString())
                        .queryParam("scope", "MINE")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].custom").value(true))
                .andExpect(jsonPath("$[1].custom").value(true))
                .andExpect(jsonPath("$[0].createdBy").value(u1.getId().toString()))
                .andExpect(jsonPath("$[1].createdBy").value(u1.getId().toString()));
    }

    @Test
    void list_scope_ALL_returns_defaults_plus_my_custom_only() throws Exception {
        User u1 = persistUser();
        User u2 = persistUser();

        persistDefaultType("Study");
        persistDefaultType("Gym");

        ActivityType mine = persistCustomType(u1, "Chess");
        persistCustomType(u2, "Reading");

        mockMvc.perform(get("/api/activity-types")
                        .header("X-User-Id", u1.getId().toString())
                        .queryParam("scope", "ALL")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                // mine exists
                .andExpect(jsonPath("$[?(@.id=='" + mine.getId() + "')].id").exists());
    }

    @Test
    void list_invalid_scope_returns400() throws Exception {
        User u1 = persistUser();

        mockMvc.perform(get("/api/activity-types")
                        .header("X-User-Id", u1.getId().toString())
                        .queryParam("scope", "WHATEVER")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void list_missing_header_returns400() throws Exception {
        mockMvc.perform(get("/api/activity-types")
                        .queryParam("scope", "ALL")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    // ---------------- DELETE TESTS ----------------
    // Assumes endpoint: DELETE /api/activity-types/{id}
    // Rules assumed:
    // - Only custom types can be deleted
    // - Only the creator can delete
    // - On success: 204 No Content

    @Test
    void delete_custom_type_by_owner_returns204_and_removes_it() throws Exception {
        User owner = persistUser();
        ActivityType mine = persistCustomType(owner, "Chess");

        mockMvc.perform(delete("/api/activity-types/{id}", mine.getId())
                        .header("X-User-Id", owner.getId().toString()))
                .andExpect(status().isNoContent());

        // verify removed
        org.junit.jupiter.api.Assertions.assertTrue(activityTypeRepo.findById(mine.getId()).isEmpty());
    }

    @Test
    void delete_custom_type_by_non_owner_returns403() throws Exception {
        User owner = persistUser();
        User other = persistUser();
        ActivityType mine = persistCustomType(owner, "Chess");

        mockMvc.perform(delete("/api/activity-types/{id}", mine.getId())
                        .header("X-User-Id", other.getId().toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void delete_default_type_returns403() throws Exception {
        User u1 = persistUser();
        ActivityType def = persistDefaultType("Study");

        mockMvc.perform(delete("/api/activity-types/{id}", def.getId())
                        .header("X-User-Id", u1.getId().toString()))
                .andExpect(status().isForbidden());
    }

    // If your implementation uses 404 to "hide" resources instead of 403,
    // change the above two tests to expect status().isNotFound()

    // ---------- helpers ----------

    private User persistUser() {
        User u = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        u.setUsername("user_" + suffix);
        u.setEmail("user_" + suffix + "@test.com");
        u.setPassword("password_" + suffix);
        return userRepo.save(u);
    }

    private ActivityType persistDefaultType(String baseName) {
        ActivityType t = new ActivityType();
        t.setName(baseName + "_" + UUID.randomUUID());
        t.setCustom(false);     // your entity has setCustom(boolean)
        t.setCreatedBy(null);
        return activityTypeRepo.save(t);
    }

    private ActivityType persistCustomType(User creator, String baseName) {
        ActivityType t = new ActivityType();
        t.setName(baseName + "_" + UUID.randomUUID());
        t.setCustom(true);
        t.setCreatedBy(creator);
        return activityTypeRepo.save(t);
    }
}