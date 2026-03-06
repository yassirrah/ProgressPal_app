package org.progresspalbackend.progresspalbackend.integration;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRequestRepository;
import org.progresspalbackend.progresspalbackend.repository.NotificationRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionCommentRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionReactionRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Testcontainers
@AutoConfigureMockMvc
class NotificationApiTest {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:13-alpine")
            .withDatabaseName("progresspal")
            .withUsername("progress")
            .withPassword("progress");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", db::getJdbcUrl);
        r.add("spring.datasource.username", db::getUsername);
        r.add("spring.datasource.password", db::getPassword);
        r.add("spring.flyway.enabled", () -> "true");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    NotificationRepository notificationRepository;

    @Autowired
    SessionReactionRepository reactionRepository;

    @Autowired
    SessionCommentRepository commentRepository;

    @Autowired
    SessionRepository sessionRepository;

    @Autowired
    FriendRepository friendRepository;

    @Autowired
    FriendRequestRepository friendRequestRepository;

    @Autowired
    ActivityTypeRepository activityTypeRepository;

    @Autowired
    UserRepository userRepository;

    @BeforeEach
    void cleanDb() {
        notificationRepository.deleteAll();
        reactionRepository.deleteAll();
        commentRepository.deleteAll();
        sessionRepository.deleteAll();
        friendRepository.deleteAll();
        friendRequestRepository.deleteAll();
        activityTypeRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void friendRequest_createsNotification_andMarkReadWorks() throws Exception {
        User requester = persistUser();
        User receiver = persistUser();

        mvc.perform(post("/api/friends/send")
                        .header("X-User-Id", requester.getId().toString())
                        .param("receiverId", receiver.getId().toString()))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/me/notifications/unread-count")
                        .header("X-User-Id", receiver.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));

        String listBody = mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", receiver.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].type").value("FRIEND_REQUEST_RECEIVED"))
                .andExpect(jsonPath("$.content[0].actorId").value(requester.getId().toString()))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String notificationId = JsonPath.read(listBody, "$.content[0].id");

        mvc.perform(patch("/api/me/notifications/{notificationId}/read", notificationId)
                        .header("X-User-Id", receiver.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readAt").isNotEmpty());

        mvc.perform(get("/api/me/notifications/unread-count")
                        .header("X-User-Id", receiver.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));
    }

    @Test
    void commentAndLike_createNotifications_forSessionOwner() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PUBLIC);

        mvc.perform(post("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"Keep going"}
                                """))
                .andExpect(status().isCreated());

        mvc.perform(put("/api/sessions/{sessionId}/likes", session.getId())
                        .header("X-User-Id", actor.getId().toString()))
                .andExpect(status().isOk());

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", owner.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].type").value("SESSION_LIKE"))
                .andExpect(jsonPath("$.content[1].type").value("SESSION_COMMENT"));

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", actor.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    private User persistUser() {
        User user = new User();
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        user.setUsername("user_" + suffix);
        user.setEmail("user_" + suffix + "@test.com");
        user.setPassword("password_" + suffix);
        return userRepository.save(user);
    }

    private ActivityType persistActivityType(String baseName) {
        ActivityType type = new ActivityType();
        type.setName(baseName + "_" + UUID.randomUUID());
        return activityTypeRepository.save(type);
    }

    private Session persistSession(User owner, ActivityType type, Visibility visibility) {
        Session session = new Session();
        session.setUser(owner);
        session.setActivityType(type);
        session.setVisibility(visibility);
        session.setStartedAt(Instant.parse("2026-01-01T10:00:00Z"));
        session.setEndedAt(null);
        session.setTitle("focus");
        return sessionRepository.save(session);
    }
}
