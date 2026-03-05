package org.progresspalbackend.progresspalbackend.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.Friendship;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
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
import java.util.UUID;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class UserProfileApiTest {

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
    @Autowired UserRepository userRepo;
    @Autowired ActivityTypeRepository activityTypeRepo;
    @Autowired SessionRepository sessionRepo;
    @Autowired FriendRepository friendRepo;

    @BeforeEach
    void cleanDb() {
        sessionRepo.deleteAll();
        friendRepo.deleteAll();
        activityTypeRepo.deleteAll();
        userRepo.deleteAll();
    }

    @Test
    void friendViewer_getsPublicAndFriendsStats() throws Exception {
        User target = persistUser("target");
        target.setBio("target bio");
        target.setProfileImage("https://img.example/target.png");
        target = userRepo.save(target);

        User friendViewer = persistUser("friend_viewer");
        friendRepo.save(friendship(friendViewer, target));

        ActivityType reading = persistActivityType("Reading");
        ActivityType coding = persistActivityType("Coding");

        Session publicSession = session(target, reading, Visibility.PUBLIC,
                Instant.parse("2026-01-01T10:00:00Z"),
                Instant.parse("2026-01-01T11:00:00Z"));
        Session friendsSession = session(target, coding, Visibility.FRIENDS,
                Instant.parse("2026-01-02T10:00:00Z"),
                Instant.parse("2026-01-02T10:30:00Z"));
        Session privateSession = session(target, reading, Visibility.PRIVATE,
                Instant.parse("2026-01-03T10:00:00Z"),
                Instant.parse("2026-01-03T11:00:00Z"));

        publicSession = sessionRepo.save(publicSession);
        friendsSession = sessionRepo.save(friendsSession);
        sessionRepo.save(privateSession);

        mvc.perform(get("/api/users/{id}/profile", target.getId())
                        .header("X-User-Id", friendViewer.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(target.getId().toString()))
                .andExpect(jsonPath("$.username").value(target.getUsername()))
                .andExpect(jsonPath("$.bio").value("target bio"))
                .andExpect(jsonPath("$.profileImage").value("https://img.example/target.png"))
                .andExpect(jsonPath("$.viewerScope").value("FRIEND"))
                .andExpect(jsonPath("$.stats.totalSessions").value(2))
                .andExpect(jsonPath("$.stats.totalVisibleDurationSeconds").value(5400))
                .andExpect(jsonPath("$.stats.topActivityTypesByVisibleDuration.length()").value(2))
                .andExpect(jsonPath("$.stats.topActivityTypesByVisibleDuration[0].activityTypeName").value(startsWith("Reading_")))
                .andExpect(jsonPath("$.stats.topActivityTypesByVisibleDuration[0].totalDurationSeconds").value(3600))
                .andExpect(jsonPath("$.stats.recentSessions.length()").value(2))
                .andExpect(jsonPath("$.stats.recentSessions[0].id").value(friendsSession.getId().toString()))
                .andExpect(jsonPath("$.stats.recentSessions[0].visibility").value("FRIENDS"))
                .andExpect(jsonPath("$.stats.recentSessions[1].id").value(publicSession.getId().toString()))
                .andExpect(jsonPath("$.stats.recentSessions[1].visibility").value("PUBLIC"));
    }

    @Test
    void nonFriendViewer_getsPublicStatsOnly() throws Exception {
        User target = persistUser("target");
        User stranger = persistUser("stranger");

        ActivityType reading = persistActivityType("Reading");
        ActivityType coding = persistActivityType("Coding");

        Session publicSession = session(target, reading, Visibility.PUBLIC,
                Instant.parse("2026-01-01T10:00:00Z"),
                Instant.parse("2026-01-01T11:00:00Z"));
        Session friendsSession = session(target, coding, Visibility.FRIENDS,
                Instant.parse("2026-01-02T10:00:00Z"),
                Instant.parse("2026-01-02T10:30:00Z"));

        publicSession = sessionRepo.save(publicSession);
        sessionRepo.save(friendsSession);

        mvc.perform(get("/api/users/{id}/profile", target.getId())
                        .header("X-User-Id", stranger.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerScope").value("PUBLIC"))
                .andExpect(jsonPath("$.stats.totalSessions").value(1))
                .andExpect(jsonPath("$.stats.totalVisibleDurationSeconds").value(3600))
                .andExpect(jsonPath("$.stats.topActivityTypesByVisibleDuration.length()").value(1))
                .andExpect(jsonPath("$.stats.recentSessions.length()").value(1))
                .andExpect(jsonPath("$.stats.recentSessions[0].id").value(publicSession.getId().toString()))
                .andExpect(jsonPath("$.stats.recentSessions[0].visibility").value("PUBLIC"));
    }

    @Test
    void ownerViewer_getsAllVisibleStatsIncludingPrivate() throws Exception {
        User target = persistUser("target");

        ActivityType reading = persistActivityType("Reading");
        ActivityType coding = persistActivityType("Coding");

        sessionRepo.save(session(target, reading, Visibility.PUBLIC,
                Instant.parse("2026-01-01T10:00:00Z"),
                Instant.parse("2026-01-01T11:00:00Z")));
        sessionRepo.save(session(target, coding, Visibility.FRIENDS,
                Instant.parse("2026-01-02T10:00:00Z"),
                Instant.parse("2026-01-02T10:30:00Z")));
        Session privateSession = sessionRepo.save(session(target, reading, Visibility.PRIVATE,
                Instant.parse("2026-01-03T10:00:00Z"),
                Instant.parse("2026-01-03T11:00:00Z")));

        mvc.perform(get("/api/users/{id}/profile", target.getId())
                        .header("X-User-Id", target.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerScope").value("OWNER"))
                .andExpect(jsonPath("$.stats.totalSessions").value(3))
                .andExpect(jsonPath("$.stats.totalVisibleDurationSeconds").value(9000))
                .andExpect(jsonPath("$.stats.recentSessions.length()").value(3))
                .andExpect(jsonPath("$.stats.recentSessions[0].id").value(privateSession.getId().toString()))
                .andExpect(jsonPath("$.stats.recentSessions[0].visibility").value("PRIVATE"));
    }

    @Test
    void getProfile_userNotFound_returns404() throws Exception {
        User actor = persistUser("actor");

        mvc.perform(get("/api/users/{id}/profile", UUID.randomUUID())
                        .header("X-User-Id", actor.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void getProfile_missingAuth_returns401() throws Exception {
        User target = persistUser("target");

        mvc.perform(get("/api/users/{id}/profile", target.getId())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    private User persistUser(String base) {
        User user = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        user.setUsername(base + "_" + suffix);
        user.setEmail(base + "_" + suffix + "@test.com");
        user.setPassword("password_" + suffix);
        return userRepo.save(user);
    }

    private ActivityType persistActivityType(String base) {
        ActivityType type = new ActivityType();
        type.setName(base + "_" + UUID.randomUUID());
        return activityTypeRepo.save(type);
    }

    private Friendship friendship(User user, User friend) {
        Friendship friendship = new Friendship();
        friendship.setUser(user);
        friendship.setFriend(friend);
        friendship.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return friendship;
    }

    private Session session(User user, ActivityType activityType, Visibility visibility, Instant startedAt, Instant endedAt) {
        Session session = new Session();
        session.setUser(user);
        session.setActivityType(activityType);
        session.setVisibility(visibility);
        session.setTitle("session");
        session.setStartedAt(startedAt);
        session.setEndedAt(endedAt);
        session.setPausedDurationSeconds(0L);
        return session;
    }
}
