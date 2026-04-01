package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.Notification;
import org.progresspalbackend.progresspalbackend.domain.NotificationScope;
import org.progresspalbackend.progresspalbackend.domain.NotificationResourceType;
import org.progresspalbackend.progresspalbackend.domain.NotificationType;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.dto.notification.NotificationDto;
import org.progresspalbackend.progresspalbackend.dto.notification.NotificationUnreadCountDto;
import org.progresspalbackend.progresspalbackend.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final EnumSet<NotificationType> HOST_ROOM_TYPES = EnumSet.of(
            NotificationType.SESSION_JOIN_REQUEST_RECEIVED,
            NotificationType.SESSION_ROOM_MESSAGE_RECEIVED
    );

    private final NotificationRepository notificationRepository;

    public void notifyFriendRequestReceived(User recipient, User actor, UUID friendRequestId) {
        create(
                recipient,
                actor,
                NotificationType.FRIEND_REQUEST_RECEIVED,
                NotificationResourceType.FRIEND_REQUEST,
                friendRequestId,
                actor.getUsername() + " sent you a friend request."
        );
    }

    public void notifyFriendRequestAccepted(User recipient, User actor, UUID friendRequestId) {
        create(
                recipient,
                actor,
                NotificationType.FRIEND_REQUEST_ACCEPTED,
                NotificationResourceType.FRIEND_REQUEST,
                friendRequestId,
                actor.getUsername() + " accepted your friend request."
        );
    }

    public void notifySessionComment(User recipient, User actor, UUID commentId) {
        create(
                recipient,
                actor,
                NotificationType.SESSION_COMMENT,
                NotificationResourceType.COMMENT,
                commentId,
                actor.getUsername() + " commented on your session."
        );
    }

    public void notifySessionLike(User recipient, User actor, UUID reactionId) {
        create(
                recipient,
                actor,
                NotificationType.SESSION_LIKE,
                NotificationResourceType.REACTION,
                reactionId,
                actor.getUsername() + " liked your session."
        );
    }

    public void notifySessionJoinRequestReceived(User recipient, User actor, UUID sessionId) {
        create(
                recipient,
                actor,
                NotificationType.SESSION_JOIN_REQUEST_RECEIVED,
                NotificationResourceType.SESSION,
                sessionId,
                actor.getUsername() + " requested to join your session."
        );
    }

    public void notifySessionJoinRequestAccepted(User recipient, User actor, UUID sessionId) {
        create(
                recipient,
                actor,
                NotificationType.SESSION_JOIN_REQUEST_ACCEPTED,
                NotificationResourceType.SESSION,
                sessionId,
                actor.getUsername() + " accepted your join request."
        );
    }

    @Transactional
    public void notifySessionRoomMessageReceived(User recipient, User actor, UUID sessionId) {
        if (recipient == null || actor == null || recipient.getId().equals(actor.getId())) {
            return;
        }

        Instant createdAt = Instant.now();
        notificationRepository.upsertUnreadRoomMessageNotification(
                UUID.randomUUID(),
                recipient.getId(),
                actor.getId(),
                NotificationType.SESSION_ROOM_MESSAGE_RECEIVED.name(),
                NotificationResourceType.SESSION.name(),
                sessionId,
                actor.getUsername() + " sent a message in your room.",
                createdAt
        );
    }

    public void notifySessionStarted(User recipient, User actor, UUID sessionId) {
        create(
                recipient,
                actor,
                NotificationType.SESSION_STARTED,
                NotificationResourceType.SESSION,
                sessionId,
                actor.getUsername() + " started a new session."
        );
    }

    @Transactional(readOnly = true)
    public Page<NotificationDto> list(UUID recipientId, NotificationScope scope, Pageable pageable) {
        return (switch (normalizeScope(scope)) {
            case ALL -> notificationRepository.findAllByRecipient_IdOrderByCreatedAtDesc(recipientId, pageable);
            case HOST_ROOM -> notificationRepository.findAllByRecipient_IdAndTypeInOrderByCreatedAtDesc(
                    recipientId,
                    HOST_ROOM_TYPES,
                    pageable
            );
            case NAVBAR -> notificationRepository.findAllByRecipient_IdAndTypeNotInOrderByCreatedAtDesc(
                    recipientId,
                    HOST_ROOM_TYPES,
                    pageable
            );
        })
                .map(this::toDto);
    }

    public NotificationUnreadCountDto unreadCount(UUID recipientId, NotificationScope scope) {
        long count = switch (normalizeScope(scope)) {
            case ALL -> notificationRepository.countByRecipient_IdAndReadAtIsNull(recipientId);
            case HOST_ROOM -> notificationRepository.countByRecipient_IdAndReadAtIsNullAndTypeIn(recipientId, HOST_ROOM_TYPES);
            case NAVBAR -> notificationRepository.countByRecipient_IdAndReadAtIsNullAndTypeNotIn(recipientId, HOST_ROOM_TYPES);
        };
        return new NotificationUnreadCountDto(count);
    }

    @Transactional
    public NotificationDto markRead(UUID recipientId, UUID notificationId) {
        Notification notification = notificationRepository.findByIdAndRecipient_Id(notificationId, recipientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));

        if (notification.getReadAt() == null) {
            notification.setReadAt(Instant.now());
            notification = notificationRepository.save(notification);
        }

        return toDto(notification);
    }

    @Transactional
    public void markAllRead(UUID recipientId, NotificationScope scope, UUID resourceId) {
        Instant readAt = Instant.now();
        List<Notification> unreadNotifications = resourceId == null
                ? notificationRepository.findAllByRecipient_IdAndReadAtIsNull(recipientId)
                : notificationRepository.findAllByRecipient_IdAndReadAtIsNullAndResourceId(recipientId, resourceId);

        List<Notification> notificationsToRead = unreadNotifications.stream()
                .filter(notification -> matchesScope(notification.getType(), normalizeScope(scope)))
                .toList();

        notificationsToRead.forEach(notification -> notification.setReadAt(readAt));
        notificationRepository.saveAll(notificationsToRead);
    }

    @Transactional
    public void clearAll(UUID recipientId) {
        notificationRepository.deleteByRecipient_Id(recipientId);
    }

    @Transactional
    public void markSessionJoinRequestReceivedAsRead(User recipient, User actor, UUID sessionId) {
        if (recipient == null || actor == null) {
            return;
        }

        Instant readAt = Instant.now();
        List<Notification> notifications = notificationRepository
                .findAllByRecipient_IdAndActor_IdAndTypeAndResourceTypeAndResourceIdAndReadAtIsNull(
                        recipient.getId(),
                        actor.getId(),
                        NotificationType.SESSION_JOIN_REQUEST_RECEIVED,
                        NotificationResourceType.SESSION,
                        sessionId
                );
        notifications.forEach(notification -> notification.setReadAt(readAt));
        notificationRepository.saveAll(notifications);
    }

    private void create(User recipient,
                        User actor,
                        NotificationType type,
                        NotificationResourceType resourceType,
                        UUID resourceId,
                        String message) {
        if (recipient == null || actor == null) {
            return;
        }

        if (recipient.getId().equals(actor.getId())) {
            return;
        }

        Notification notification = new Notification();
        notification.setRecipient(recipient);
        notification.setActor(actor);
        notification.setType(type);
        notification.setResourceType(resourceType);
        notification.setResourceId(resourceId);
        notification.setMessage(message);
        notification.setCreatedAt(Instant.now());

        notificationRepository.save(notification);
    }

    private NotificationScope normalizeScope(NotificationScope scope) {
        return scope == null ? NotificationScope.NAVBAR : scope;
    }

    private boolean matchesScope(NotificationType type, NotificationScope scope) {
        return switch (scope) {
            case ALL -> true;
            case HOST_ROOM -> HOST_ROOM_TYPES.contains(type);
            case NAVBAR -> !HOST_ROOM_TYPES.contains(type);
        };
    }

    private NotificationDto toDto(Notification notification) {
        User actor = notification.getActor();
        return new NotificationDto(
                notification.getId(),
                notification.getType(),
                notification.getMessage(),
                actor != null ? actor.getId() : null,
                actor != null ? actor.getUsername() : null,
                actor != null ? actor.getProfileImage() : null,
                notification.getResourceType(),
                notification.getResourceId(),
                notification.getReadAt(),
                notification.getCreatedAt()
        );
    }
}
