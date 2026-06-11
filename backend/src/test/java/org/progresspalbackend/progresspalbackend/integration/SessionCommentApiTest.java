package org.progresspalbackend.progresspalbackend.integration;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.NotificationResourceType;
import org.progresspalbackend.progresspalbackend.domain.NotificationType;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.NotificationRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionCommentRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Testcontainers
@AutoConfigureMockMvc
class SessionCommentApiTest {

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
    SessionCommentRepository commentRepository;

    @Autowired
    NotificationRepository notificationRepository;

    @Autowired
    SessionRepository sessionRepository;

    @Autowired
    ActivityTypeRepository activityTypeRepository;

    @Autowired
    FriendRepository friendRepository;

    @Autowired
    UserRepository userRepository;

    @BeforeEach
    void cleanDb() {
        notificationRepository.deleteAll();
        commentRepository.deleteAllInBatch();
        sessionRepository.deleteAll();
        friendRepository.deleteAll();
        activityTypeRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void createAndListComment_onPublicSession_returnsCreatedComment() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PUBLIC);

        mvc.perform(post("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"Great consistency!"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionId").value(session.getId().toString()))
                .andExpect(jsonPath("$.authorId").value(actor.getId().toString()))
                .andExpect(jsonPath("$.authorUsername").value(actor.getUsername()))
                .andExpect(jsonPath("$.parentCommentId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.content").value("Great consistency!"))
                .andExpect(jsonPath("$.editable").value(true));

        mvc.perform(get("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", owner.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].content").value("Great consistency!"));
    }

    @Test
    void createReply_toTopLevelComment_returnsCreatedReply() throws Exception {
        User owner = persistUser();
        User parentAuthor = persistUser();
        User replier = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PUBLIC);
        String parentId = JsonPath.read(createComment(session, parentAuthor, "Root thought"), "$.id");

        mvc.perform(post("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", replier.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"Replying here","parentCommentId":"%s"}
                                """.formatted(parentId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionId").value(session.getId().toString()))
                .andExpect(jsonPath("$.parentCommentId").value(parentId))
                .andExpect(jsonPath("$.authorId").value(replier.getId().toString()))
                .andExpect(jsonPath("$.content").value("Replying here"))
                .andExpect(jsonPath("$.editable").value(true));

        mvc.perform(get("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", owner.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.content == 'Replying here')].parentCommentId")
                        .value(org.hamcrest.Matchers.contains(parentId)));
    }

    @Test
    void createReply_toReply_returns400() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PUBLIC);
        String parentId = JsonPath.read(createComment(session, owner, "Root thought"), "$.id");
        String replyId = JsonPath.read(createReply(session, actor, "First reply", parentId), "$.id");

        mvc.perform(post("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"Nested reply","parentCommentId":"%s"}
                                """.formatted(replyId)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createReply_toCommentFromAnotherSession_returns400() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Study");
        Session firstSession = persistSession(owner, type, Visibility.PUBLIC);
        Session secondSession = persistSession(owner, type, Visibility.PUBLIC);
        String parentId = JsonPath.read(createComment(firstSession, owner, "Wrong thread"), "$.id");

        mvc.perform(post("/api/sessions/{sessionId}/comments", secondSession.getId())
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"Wrong session reply","parentCommentId":"%s"}
                                """.formatted(parentId)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createReply_onPrivateSessionByNonOwner_returns403() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PRIVATE);
        String parentId = JsonPath.read(createComment(session, owner, "Private root"), "$.id");

        mvc.perform(post("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"I should not see this","parentCommentId":"%s"}
                                """.formatted(parentId)))
                .andExpect(status().isForbidden());
    }

    @Test
    void createComment_onPrivateSessionByNonOwner_returns403() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PRIVATE);

        mvc.perform(post("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"Can I join?"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void deleteComment_bySessionOwner_returns204() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PUBLIC);

        String body = createComment(session, actor, "Nice pace");
        String commentId = JsonPath.read(body, "$.id");

        mvc.perform(delete("/api/sessions/{sessionId}/comments/{commentId}", session.getId(), commentId)
                        .header("X-User-Id", owner.getId().toString()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", owner.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void deleteReply_byReplyAuthor_returns204() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PUBLIC);
        String parentId = JsonPath.read(createComment(session, owner, "Root thought"), "$.id");
        String replyId = JsonPath.read(createReply(session, actor, "My reply", parentId), "$.id");

        mvc.perform(delete("/api/sessions/{sessionId}/comments/{commentId}", session.getId(), replyId)
                        .header("X-User-Id", actor.getId().toString()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", owner.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(parentId));
    }

    @Test
    void deleteReply_bySessionOwner_returns204() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PUBLIC);
        String parentId = JsonPath.read(createComment(session, owner, "Root thought"), "$.id");
        String replyId = JsonPath.read(createReply(session, actor, "My reply", parentId), "$.id");

        mvc.perform(delete("/api/sessions/{sessionId}/comments/{commentId}", session.getId(), replyId)
                        .header("X-User-Id", owner.getId().toString()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", owner.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void createReply_notifiesParentCommentAuthor() throws Exception {
        User owner = persistUser();
        User parentAuthor = persistUser();
        User replier = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PUBLIC);
        String parentId = JsonPath.read(createComment(session, parentAuthor, "Root thought"), "$.id");
        notificationRepository.deleteAll();

        String replyId = JsonPath.read(createReply(session, replier, "Replying here", parentId), "$.id");

        var notifications = notificationRepository.findAll();
        assertThat(notifications).hasSize(1);
        var notification = notifications.get(0);
        assertThat(notification.getRecipient().getId()).isEqualTo(parentAuthor.getId());
        assertThat(notification.getActor().getId()).isEqualTo(replier.getId());
        assertThat(notification.getType()).isEqualTo(NotificationType.SESSION_COMMENT);
        assertThat(notification.getResourceType()).isEqualTo(NotificationResourceType.COMMENT);
        assertThat(notification.getResourceId().toString()).isEqualTo(replyId);
        assertThat(notification.getMessage()).isEqualTo(replier.getUsername() + " replied to your comment.");
    }

    @Test
    void createReply_toOwnComment_createsNoNotification() throws Exception {
        User owner = persistUser();
        User actor = persistUser();
        ActivityType type = persistActivityType("Study");
        Session session = persistSession(owner, type, Visibility.PUBLIC);
        String parentId = JsonPath.read(createComment(session, actor, "My thought"), "$.id");
        notificationRepository.deleteAll();

        createReply(session, actor, "Replying to myself", parentId);

        assertThat(notificationRepository.findAll()).isEmpty();
    }

    private String createComment(Session session, User actor, String content) throws Exception {
        return mvc.perform(post("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"%s"}
                                """.formatted(content)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private String createReply(Session session, User actor, String content, String parentCommentId) throws Exception {
        return mvc.perform(post("/api/sessions/{sessionId}/comments", session.getId())
                        .header("X-User-Id", actor.getId().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"%s","parentCommentId":"%s"}
                                """.formatted(content, parentCommentId)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
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
