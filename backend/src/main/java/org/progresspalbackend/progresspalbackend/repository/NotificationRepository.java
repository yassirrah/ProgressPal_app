package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.Notification;
import org.progresspalbackend.progresspalbackend.domain.NotificationResourceType;
import org.progresspalbackend.progresspalbackend.domain.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findAllByRecipient_IdOrderByCreatedAtDesc(UUID recipientId, Pageable pageable);
    Page<Notification> findAllByRecipient_IdAndTypeInOrderByCreatedAtDesc(UUID recipientId,
                                                                          Collection<NotificationType> types,
                                                                          Pageable pageable);
    Page<Notification> findAllByRecipient_IdAndTypeNotInOrderByCreatedAtDesc(UUID recipientId,
                                                                             Collection<NotificationType> types,
                                                                             Pageable pageable);

    long countByRecipient_IdAndReadAtIsNull(UUID recipientId);
    long countByRecipient_IdAndReadAtIsNullAndTypeIn(UUID recipientId, Collection<NotificationType> types);
    long countByRecipient_IdAndReadAtIsNullAndTypeNotIn(UUID recipientId, Collection<NotificationType> types);

    Optional<Notification> findByIdAndRecipient_Id(UUID id, UUID recipientId);

    List<Notification> findAllByRecipient_IdAndActor_IdAndTypeAndResourceTypeAndResourceIdAndReadAtIsNull(
            UUID recipientId,
            UUID actorId,
            NotificationType type,
            NotificationResourceType resourceType,
            UUID resourceId
    );

    List<Notification> findAllByRecipient_IdAndReadAtIsNull(UUID recipientId);
    List<Notification> findAllByRecipient_IdAndReadAtIsNullAndResourceId(UUID recipientId, UUID resourceId);

    @Modifying
    @Query(value = """
            insert into notification (
                id,
                recipient_id,
                actor_id,
                type,
                resource_type,
                resource_id,
                message,
                created_at,
                read_at
            )
            values (
                :id,
                :recipientId,
                :actorId,
                :type,
                :resourceType,
                :resourceId,
                :message,
                :createdAt,
                null
            )
            on conflict (recipient_id, type, resource_type, resource_id)
            where type = 'SESSION_ROOM_MESSAGE_RECEIVED'
              and resource_type = 'SESSION'
              and read_at is null
            do update
               set actor_id = excluded.actor_id,
                   message = excluded.message,
                   created_at = excluded.created_at
            """, nativeQuery = true)
    int upsertUnreadRoomMessageNotification(@Param("id") UUID id,
                                            @Param("recipientId") UUID recipientId,
                                            @Param("actorId") UUID actorId,
                                            @Param("type") String type,
                                            @Param("resourceType") String resourceType,
                                            @Param("resourceId") UUID resourceId,
                                            @Param("message") String message,
                                            @Param("createdAt") Instant createdAt);

    long deleteByRecipient_Id(UUID recipientId);

    @Modifying
    @Query("""
            update Notification n
               set n.readAt = :readAt
             where n.recipient.id = :recipientId
               and n.readAt is null
            """)
    int markAllUnreadAsRead(@Param("recipientId") UUID recipientId, @Param("readAt") Instant readAt);
}
