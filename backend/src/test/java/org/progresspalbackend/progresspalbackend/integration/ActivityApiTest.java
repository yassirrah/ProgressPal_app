package org.progresspalbackend.progresspalbackend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.dto.ActivityCreateDto;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class ActivityApiTest {

    /* ── 1. Start a throw-away Postgres container ───────────── */
    @Container
    static PostgreSQLContainer<?> db =
            new PostgreSQLContainer<>("postgres:15-alpine")
                    .withDatabaseName("progresspal")
                    .withUsername("progress")
                    .withPassword("progress");

    /* ── 2. Plug container’s JDBC URL into Spring at runtime ── */
    @DynamicPropertySource
    static void overrideProps(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",      db::getJdbcUrl);
        r.add("spring.datasource.username", db::getUsername);
        r.add("spring.datasource.password", db::getPassword);
    }

    /* ── 3. Inject MockMvc + ObjectMapper ───────────────────── */
    @Autowired
    MockMvc mvc;
    @Autowired
    ObjectMapper json;

    /* ── 4. Helper UUIDs (insert once per test run) ─────────── */
    static final UUID USER_ID  = UUID.randomUUID();
    static final UUID TYPE_ID  = UUID.randomUUID();

    @BeforeAll
    static void seedLookupRows(@Autowired MockMvc mvc,
                               @Autowired ObjectMapper json) throws Exception {

        /* Insert a user */
        mvc.perform(post("/api/users")               // assumes you’ll add User controller later
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\""+ USER_ID +"\",\"username\":\"test\",\"email\":\"t@t.com\",\"password\":\"x\"}"))
                .andExpect(status().isCreated());

        /* Insert an activity type */
        mvc.perform(post("/api/activity-types")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\""+ TYPE_ID +"\",\"name\":\"TestType\"}"))
                .andExpect(status().isCreated());
    }

    /* ── 5. Actual test: POST then GET list size = 1 ─────────── */
    @Test
    void post_then_get() throws Exception {

        ActivityCreateDto dto = new ActivityCreateDto(
                USER_ID, TYPE_ID,
                "JUnit post", "Made in integration test", Visibility.PUBLIC);

        /* POST */
        mvc.perform(post("/api/activities")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(dto)))
                .andExpect(status().isCreated());

        /* GET list returns ≥ 1 */
        mvc.perform(get("/api/activities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }
}