package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.Notification;
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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

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

    @Transactional(readOnly = true)
    public Page<NotificationDto> list(UUID recipientId, Pageable pageable) {
        return notificationRepository.findAllByRecipient_IdOrderByCreatedAtDesc(recipientId, pageable)
                .map(this::toDto);
    }

    public NotificationUnreadCountDto unreadCount(UUID recipientId) {
        long count = notificationRepository.countByRecipient_IdAndReadAtIsNull(recipientId);
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
    public void markAllRead(UUID recipientId) {
        notificationRepository.markAllUnreadAsRead(recipientId, Instant.now());
    }

    @Transactional
    public void clearAll(UUID recipientId) {
        notificationRepository.deleteByRecipient_Id(recipientId);
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
