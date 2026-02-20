package org.progresspalbackend.progresspalbackend.repository;


import org.progresspalbackend.progresspalbackend.domain.Friendship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FriendRepository extends JpaRepository<Friendship, UUID> {

    List<Friendship> findAllByUser_Id(UUID UserId);
    List<Friendship> findAllByFriend_Id(UUID friendId);

    boolean existsByUser_IdAndFriend_Id(UUID userId, UUID friendId);
}
