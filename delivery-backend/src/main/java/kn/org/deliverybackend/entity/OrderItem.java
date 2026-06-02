package kn.org.deliverybackend.entity;

import jakarta.persistence.*;
import kn.org.deliverybackend.entity.base.AbstractBaseEntity;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "order_item")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderItem extends AbstractBaseEntity<UUID> {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    private UUID orderId;

    private Long productId;

    private Integer quantity;

    private BigDecimal priceAtOrder;

    private Long variantId;

    // Variant attributes snapshotted at order time so the order history stays
    // accurate even if the variant is later edited or soft-deleted.
    private String variantName;

    private String variantSize;

    private String variantColor;
}
