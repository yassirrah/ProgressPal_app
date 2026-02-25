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
class MeDashboardTrendsApiTest {

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
    void trends_dayBucket_returnsStableOrderedDurationAndMetricSeries() throws Exception {
        User me = persistUser();
        User other = persistUser();

        ActivityType chess = persistActivityType("Chess", MetricKind.INTEGER, "games");
        ActivityType running = persistActivityType("Running", MetricKind.DECIMAL, "km");
        ActivityType reading = persistActivityType("Reading", MetricKind.NONE, null);

        sessionRepo.save(session(me, chess, Instant.parse("2026-01-03T09:00:00Z"), 1800, new BigDecimal("2")));
        sessionRepo.save(session(me, running, Instant.parse("2026-01-03T10:00:00Z"), 1200, new BigDecimal("5.5")));
        sessionRepo.save(session(me, chess, Instant.parse("2026-01-04T09:00:00Z"), 600, new BigDecimal("3")));
        sessionRepo.save(session(me, reading, Instant.parse("2026-01-05T09:00:00Z"), 900, null));
        sessionRepo.save(session(other, chess, Instant.parse("2026-01-04T11:00:00Z"), 9999, new BigDecimal("99")));

        mvc.perform(get("/api/me/dashboard/trends")
                        .header("X-User-Id", me.getId().toString())
                        .queryParam("from", "2026-01-03")
                        .queryParam("to", "2026-01-05")
                        .queryParam("bucket", "DAY")
                        .queryParam("activityTypeId", chess.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bucket").value("DAY"))
                .andExpect(jsonPath("$.durationSeries.length()").value(3))
                .andExpect(jsonPath("$.durationSeries[0].bucketStart").value("2026-01-03"))
                .andExpect(jsonPath("$.durationSeries[0].totalDurationSeconds").value(3000))
                .andExpect(jsonPath("$.durationSeries[1].bucketStart").value("2026-01-04"))
                .andExpect(jsonPath("$.durationSeries[1].totalDurationSeconds").value(600))
                .andExpect(jsonPath("$.durationSeries[2].bucketStart").value("2026-01-05"))
                .andExpect(jsonPath("$.durationSeries[2].totalDurationSeconds").value(900))
                .andExpect(jsonPath("$.metricActivityTypeId").value(chess.getId().toString()))
                .andExpect(jsonPath("$.metricLabel").value("games"))
                .andExpect(jsonPath("$.metricSeries.length()").value(2))
                .andExpect(jsonPath("$.metricSeries[0].bucketStart").value("2026-01-03"))
                .andExpect(jsonPath("$.metricSeries[0].totalMetricValue").value(2))
                .andExpect(jsonPath("$.metricSeries[1].bucketStart").value("2026-01-04"))
                .andExpect(jsonPath("$.metricSeries[1].totalMetricValue").value(3));
    }

    @Test
    void trends_weekBucket_groupsByIsoWeek_andNoMetricTypeReturnsNullMetricFields() throws Exception {
        User me = persistUser();
        ActivityType reading = persistActivityType("Reading", MetricKind.NONE, null);
        ActivityType chess = persistActivityType("Chess", MetricKind.INTEGER, "games");

        sessionRepo.save(session(me, reading, Instant.parse("2026-01-04T09:00:00Z"), 1200, null)); // Sunday -> 2025-12-29
        sessionRepo.save(session(me, chess, Instant.parse("2026-01-05T09:00:00Z"), 1800, new BigDecimal("4"))); // Monday -> 2026-01-05
        sessionRepo.save(session(me, reading, Instant.parse("2026-01-11T09:00:00Z"), 600, null)); // Sunday -> 2026-01-05
        sessionRepo.save(session(me, chess, Instant.parse("2026-01-12T09:00:00Z"), 2400, new BigDecimal("2"))); // Monday -> 2026-01-12

        mvc.perform(get("/api/me/dashboard/trends")
                        .header("X-User-Id", me.getId().toString())
                        .queryParam("from", "2026-01-04")
                        .queryParam("to", "2026-01-12")
                        .queryParam("bucket", "WEEK")
                        .queryParam("activityTypeId", reading.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bucket").value("WEEK"))
                .andExpect(jsonPath("$.durationSeries.length()").value(3))
                .andExpect(jsonPath("$.durationSeries[0].bucketStart").value("2025-12-29"))
                .andExpect(jsonPath("$.durationSeries[0].totalDurationSeconds").value(1200))
                .andExpect(jsonPath("$.durationSeries[1].bucketStart").value("2026-01-05"))
                .andExpect(jsonPath("$.durationSeries[1].totalDurationSeconds").value(2400))
                .andExpect(jsonPath("$.durationSeries[2].bucketStart").value("2026-01-12"))
                .andExpect(jsonPath("$.durationSeries[2].totalDurationSeconds").value(2400))
                .andExpect(jsonPath("$.metricActivityTypeId").value(reading.getId().toString()))
                .andExpect(jsonPath("$.metricLabel").isEmpty())
                .andExpect(jsonPath("$.metricSeries").isEmpty());
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

    private Session session(User user, ActivityType type, Instant startedAt, long durationSeconds, BigDecimal metricValue) {
        Session s = new Session();
        s.setUser(user);
        s.setActivityType(type);
        s.setVisibility(Visibility.PUBLIC);
        s.setStartedAt(startedAt);
        s.setEndedAt(startedAt.plusSeconds(durationSeconds));
        s.setMetricValue(metricValue);
        s.setTitle("t");
        return s;
    }
}
