package kn.org.deliverybackend.service;

import kn.org.deliverybackend.dto.OrderDTO;
import kn.org.deliverybackend.dto.order.CancelOrderRequestDTO;
import kn.org.deliverybackend.dto.order.GuestOrderRequestDTO;
import kn.org.deliverybackend.dto.order.OrderTrackingDTO;
import kn.org.deliverybackend.dto.request.order.PlaceOrderRequestDTO;

import java.util.UUID;

public interface OrderService {

    OrderDTO placeOrder(PlaceOrderRequestDTO request);

    OrderDTO placeGuestOrder(GuestOrderRequestDTO request);

    OrderDTO cancelOrder(UUID userId, UUID orderId, CancelOrderRequestDTO request);

    OrderTrackingDTO getOrderTracking(UUID orderId);

    /** Ownership-checked variant for customer-facing tracking (404s if not the owner). */
    OrderTrackingDTO getOrderTracking(UUID userId, UUID orderId);
}
