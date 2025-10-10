package org.progresspalbackend.progresspalbackend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "activity")
@Getter
@Setter
@NoArgsConstructor
public class Activity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_type_id")
    private ActivityType activityType;

    @Column(length = 120)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false)
    private Instant startedAt;

    private Instant endedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Visibility visibility;


    @Column(name = "is_ongoing", nullable = false)
    private boolean ongoing = true;
}