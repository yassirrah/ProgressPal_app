package org.progresspalbackend.progresspalbackend.integration;

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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class MeDashboardByActivityTypeApiTest {

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
    void byActivityType_returnsCorrectTotalsForDateRange_andNullMetricFieldsForNone() throws Exception {
        User me = persistUser();
        User other = persistUser();

        ActivityType chess = persistActivityType("Chess", MetricKind.INTEGER, "games");
        ActivityType running = persistActivityType("Running", MetricKind.DECIMAL, "km");
        ActivityType reading = persistActivityType("Reading", MetricKind.NONE, null);
        ActivityType outside = persistActivityType("Outside", MetricKind.INTEGER, "tasks");

        sessionRepo.save(session(me, chess, Visibility.PUBLIC, Instant.parse("2026-01-03T09:00:00Z"), 3600, new BigDecimal("10")));
        sessionRepo.save(session(me, chess, Visibility.PRIVATE, Instant.parse("2026-01-04T09:00:00Z"), 1800, new BigDecimal("5")));
        sessionRepo.save(session(me, running, Visibility.PUBLIC, Instant.parse("2026-01-04T12:00:00Z"), 2400, new BigDecimal("3.50")));
        sessionRepo.save(session(me, reading, Visibility.PUBLIC, Instant.parse("2026-01-05T08:00:00Z"), 1200, null));

        sessionRepo.save(session(me, outside, Visibility.PUBLIC, Instant.parse("2026-01-06T08:00:00Z"), 999, new BigDecimal("2"))); // outside range
        sessionRepo.save(session(other, chess, Visibility.PUBLIC, Instant.parse("2026-01-04T07:00:00Z"), 7200, new BigDecimal("99"))); // other user

        mvc.perform(get("/api/me/sessions")
                        .header("X-User-Id", me.getId().toString())
                        .queryParam("from", "2026-01-03")
                        .queryParam("to", "2026-01-05")
                        .queryParam("size", "100")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4));

        mvc.perform(get("/api/me/dashboard/by-activity-type")
                        .header("X-User-Id", me.getId().toString())
                        .queryParam("from", "2026-01-03")
                        .queryParam("to", "2026-01-05")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                // sorted by total duration desc: chess (5400), running (2400), reading (1200)
                .andExpect(jsonPath("$[0].activityTypeId").value(chess.getId().toString()))
                .andExpect(jsonPath("$[0].name").value(chess.getName()))
                .andExpect(jsonPath("$[0].totalDurationSeconds").value(5400))
                .andExpect(jsonPath("$[0].totalSessions").value(2))
                .andExpect(jsonPath("$[0].totalMetricValue").value(15))
                .andExpect(jsonPath("$[0].metricLabel").value("games"))
                .andExpect(jsonPath("$[1].activityTypeId").value(running.getId().toString()))
                .andExpect(jsonPath("$[1].totalDurationSeconds").value(2400))
                .andExpect(jsonPath("$[1].totalSessions").value(1))
                .andExpect(jsonPath("$[1].totalMetricValue").value(3.5))
                .andExpect(jsonPath("$[1].metricLabel").value("km"))
                .andExpect(jsonPath("$[2].activityTypeId").value(reading.getId().toString()))
                .andExpect(jsonPath("$[2].totalDurationSeconds").value(1200))
                .andExpect(jsonPath("$[2].totalSessions").value(1))
                .andExpect(jsonPath("$[2].totalMetricValue").isEmpty())
                .andExpect(jsonPath("$[2].metricLabel").isEmpty());
    }

    @Test
    void byActivityType_rejectsInvalidDateRange() throws Exception {
        User me = persistUser();

        mvc.perform(get("/api/me/dashboard/by-activity-type")
                        .header("X-User-Id", me.getId().toString())
                        .queryParam("from", "2026-01-10")
                        .queryParam("to", "2026-01-01")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("'from' must be before or equal to 'to'"));
    }

    private User persistUser() {
        User u = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        u.setUsername("user_" + suffix);
        u.setEmail("user_" + suffix + "@test.com");
        u.setPassword("password_" + suffix);
        return userRepo.save(u);
    }

    private ActivityType persistActivityType(String base, MetricKind metricKind, String metricLabel) {
        ActivityType t = new ActivityType();
        t.setName(base + "_" + UUID.randomUUID());
        t.setMetricKind(metricKind);
        t.setMetricLabel(metricLabel);
        return activityTypeRepo.save(t);
    }

    private Session session(User user,
                            ActivityType type,
                            Visibility visibility,
                            Instant startedAt,
                            long durationSeconds,
                            BigDecimal metricValue) {
        Session s = new Session();
        s.setUser(user);
        s.setActivityType(type);
        s.setVisibility(visibility);
        s.setStartedAt(startedAt);
        s.setEndedAt(startedAt.plusSeconds(durationSeconds));
        s.setMetricValue(metricValue);
        s.setTitle("t");
        return s;
    }
}
