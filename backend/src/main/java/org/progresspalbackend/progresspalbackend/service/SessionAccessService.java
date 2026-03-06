package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionAccessService {

    private final SessionRepository sessionRepository;
    private final FriendRepository friendRepository;

    public Session requireVisibleSession(UUID actorUserId, UUID sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));

        UUID ownerId = session.getUser().getId();
        if (ownerId.equals(actorUserId)) {
            return session;
        }

        Visibility visibility = session.getVisibility();
        if (visibility == Visibility.PUBLIC) {
            return session;
        }

        if (visibility == Visibility.FRIENDS && areUsersFriends(actorUserId, ownerId)) {
            return session;
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access this session");
    }

    private boolean areUsersFriends(UUID actorUserId, UUID ownerId) {
        return friendRepository.existsByUser_IdAndFriend_Id(actorUserId, ownerId)
                || friendRepository.existsByUser_IdAndFriend_Id(ownerId, actorUserId);
    }
}
