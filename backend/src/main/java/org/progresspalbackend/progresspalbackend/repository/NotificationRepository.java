package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findAllByRecipient_IdOrderByCreatedAtDesc(UUID recipientId, Pageable pageable);

    long countByRecipient_IdAndReadAtIsNull(UUID recipientId);

    Optional<Notification> findByIdAndRecipient_Id(UUID id, UUID recipientId);

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
