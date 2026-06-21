package org.progresspalbackend.progresspalbackend.repository;

import java.util.UUID;

public interface SessionAggregateCount {

    UUID getSessionId();

    long getCount();
}
