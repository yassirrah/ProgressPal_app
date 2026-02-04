package org.progresspalbackend.progresspalbackend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "activity_type")
@Getter
@Setter
@NoArgsConstructor
public class ActivityType {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 60)
    private String name;            // e.g. "Studying", "Gym"

    private String iconUrl;         // optional

    @Column(name = "is_custom", nullable = false)
    private boolean custom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;         // null if predefined

}