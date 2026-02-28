package org.progresspalbackend.progresspalbackend.domain;

import jakarta.persistence.*;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.*;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "session",
        indexes = {
                @Index(name = "ix_session_user_started", columnList = "user_id, started_at DESC"),
                @Index(name = "ix_session_type_started", columnList = "activity_type_id, started_at DESC")
        }
)
@Getter @Setter @NoArgsConstructor
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_type_id", nullable = false)
    private ActivityType activityType;

    @Size(max = 120)
    @Column(length = 120)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "metric_value")
    private BigDecimal metricValue;

    @Column(name = "metric_current_value")
    private BigDecimal metricCurrentValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "goal_type", nullable = false, length = 16)
    private GoalType goalType = GoalType.NONE;

    @Column(name = "goal_target", precision = 19, scale = 4)
    private BigDecimal goalTarget;

    @Size(max = 255)
    @Column(name = "goal_note", length = 255)
    private String goalNote;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", nullable = false) // remove length
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)             // ✅ Hibernate 6 way

    private Visibility visibility;

    @Transient
    public boolean isLive() {
        return endedAt == null;
    }
}
