package org.progresspalbackend.progresspalbackend.integration;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.Friendship;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

    @Test
    void sessionCreate_notifyFriendsOff_createsNoNotifications() throws Exception {
        User actor = persistUser();
        User friend = persistUser();
        ActivityType type = persistActivityType("Study");
        persistFriendship(actor, friend);

        createSession(actor, type, Visibility.PUBLIC, false);

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", friend.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));

        mvc.perform(get("/api/me/notifications/unread-count")
                        .header("X-User-Id", friend.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));
    }

    @Test
    void sessionCreate_notifyFriendsOmitted_createsNoNotifications() throws Exception {
        User actor = persistUser();
        User friend = persistUser();
        ActivityType type = persistActivityType("Study");
        persistFriendship(actor, friend);

        createSessionWithoutNotifyField(actor, type, Visibility.PUBLIC);

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", friend.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void sessionCreate_notifyFriendsNull_createsNoNotifications() throws Exception {
        User actor = persistUser();
        User friend = persistUser();
        ActivityType type = persistActivityType("Study");
        persistFriendship(actor, friend);

        createSession(actor, type, Visibility.PUBLIC, null);

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", friend.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void sessionCreate_notifyFriendsOn_public_notifiesFriendsWithoutSelfNotification() throws Exception {
        User actor = persistUser();
        User friendFromUserSide = persistUser();
        User friendFromFriendSide = persistUser();
        ActivityType type = persistActivityType("Study");
        persistFriendship(actor, friendFromUserSide);
        persistFriendship(friendFromFriendSide, actor);

        String createdSessionBody = createSession(actor, type, Visibility.PUBLIC, true);
        String sessionId = JsonPath.read(createdSessionBody, "$.id");

        String expectedMessage = actor.getUsername() + " started a new session.";

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", friendFromUserSide.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].type").value("SESSION_STARTED"))
                .andExpect(jsonPath("$.content[0].resourceType").value("SESSION"))
                .andExpect(jsonPath("$.content[0].resourceId").value(sessionId))
                .andExpect(jsonPath("$.content[0].actorId").value(actor.getId().toString()))
                .andExpect(jsonPath("$.content[0].actorUsername").value(actor.getUsername()))
                .andExpect(jsonPath("$.content[0].message").value(expectedMessage));

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", friendFromFriendSide.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].type").value("SESSION_STARTED"));

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", actor.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));

        mvc.perform(get("/api/me/notifications/unread-count")
                        .header("X-User-Id", friendFromUserSide.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));

        mvc.perform(get("/api/me/notifications/unread-count")
                        .header("X-User-Id", friendFromFriendSide.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));
    }

    @Test
    void sessionCreate_notifyFriendsOn_friendsVisibility_notifiesFriends() throws Exception {
        User actor = persistUser();
        User friend = persistUser();
        ActivityType type = persistActivityType("Study");
        persistFriendship(friend, actor);

        createSession(actor, type, Visibility.FRIENDS, true);

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", friend.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].type").value("SESSION_STARTED"));
    }

    @Test
    void sessionCreate_notifyFriendsOn_privateVisibility_createsNoNotifications() throws Exception {
        User actor = persistUser();
        User friend = persistUser();
        ActivityType type = persistActivityType("Study");
        persistFriendship(actor, friend);

        createSession(actor, type, Visibility.PRIVATE, true);

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", friend.getId().toString())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void clearAll_removesOnlyCurrentUsersNotifications() throws Exception {
        User requesterA = persistUser();
        User requesterB = persistUser();
        User receiver = persistUser();
        User otherReceiver = persistUser();

        mvc.perform(post("/api/friends/send")
                        .header("X-User-Id", requesterA.getId().toString())
                        .param("receiverId", receiver.getId().toString()))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/friends/send")
                        .header("X-User-Id", requesterB.getId().toString())
                        .param("receiverId", receiver.getId().toString()))
                .andExpect(status().isCreated());

        mvc.perform(post("/api/friends/send")
                        .header("X-User-Id", requesterA.getId().toString())
                        .param("receiverId", otherReceiver.getId().toString()))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", receiver.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2));

        mvc.perform(delete("/api/me/notifications")
                        .header("X-User-Id", receiver.getId().toString()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", receiver.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0));

        mvc.perform(get("/api/me/notifications/unread-count")
                        .header("X-User-Id", receiver.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));

        mvc.perform(get("/api/me/notifications")
                        .header("X-User-Id", otherReceiver.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1));
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

    private void persistFriendship(User user, User friend) {
        Friendship friendship = new Friendship();
        friendship.setUser(user);
        friendship.setFriend(friend);
        friendship.setCreatedAt(Instant.now());
        friendRepository.save(friendship);
    }

    private String createSession(User owner, ActivityType type, Visibility visibility, Boolean notifyFriends) throws Exception {
        String notifyValue = notifyFriends == null ? "null" : notifyFriends.toString();
        String payload = """
                {
                  "activityTypeId":"%s",
                  "title":"focus",
                  "visibility":"%s",
                  "goalType":"NONE",
                  "notifyFriends":%s
                }
                """.formatted(type.getId(), visibility.name(), notifyValue);

        return mvc.perform(post("/api/sessions")
                        .header("X-User-Id", owner.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private String createSessionWithoutNotifyField(User owner, ActivityType type, Visibility visibility) throws Exception {
        String payload = """
                {
                  "activityTypeId":"%s",
                  "title":"focus",
                  "visibility":"%s",
                  "goalType":"NONE"
                }
                """.formatted(type.getId(), visibility.name());

        return mvc.perform(post("/api/sessions")
                        .header("X-User-Id", owner.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }
}
