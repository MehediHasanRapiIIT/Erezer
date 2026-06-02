package kn.org.deliverybackend.service.impl;

import kn.org.deliverybackend.dto.checkout.CheckoutQuoteRequestDTO;
import kn.org.deliverybackend.dto.checkout.CheckoutQuoteResponseDTO;
import kn.org.deliverybackend.dto.coupon.CouponValidateRequestDTO;
import kn.org.deliverybackend.dto.coupon.CouponValidateResponseDTO;
import kn.org.deliverybackend.dto.request.order.OrderItemRequestDTO;
import kn.org.deliverybackend.entity.Product;
import kn.org.deliverybackend.entity.ShippingZone;
import kn.org.deliverybackend.exception.ResourceNotFoundException;
import kn.org.deliverybackend.repository.ProductRepository;
import kn.org.deliverybackend.repository.ShippingZoneRepository;
import kn.org.deliverybackend.service.CheckoutQuoteService;
import kn.org.deliverybackend.service.CouponService;
import kn.org.deliverybackend.service.ShippingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class CheckoutQuoteServiceImpl implements CheckoutQuoteService {

    private final ProductRepository productRepository;
    private final ShippingZoneRepository shippingZoneRepository;
    private final ShippingService shippingService;
    private final CouponService couponService;

    @Override
    @Transactional(readOnly = true)
    public CheckoutQuoteResponseDTO quote(CheckoutQuoteRequestDTO request) {
        // 1. Sum current product prices × quantities to get the subtotal.
        BigDecimal subtotal = BigDecimal.ZERO;
        for (OrderItemRequestDTO item : request.getItems()) {
            Product p = productRepository.findById(item.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Product not found: " + item.getProductId()));
            BigDecimal unit = p.getDiscountPrice() != null ? p.getDiscountPrice() : p.getPrice();
            subtotal = subtotal.add(unit.multiply(BigDecimal.valueOf(item.getQuantity())));
        }

        // 2. Resolve the shipping zone.
        ShippingZone zone = request.getShippingZoneId() != null
                ? shippingZoneRepository.findById(request.getShippingZoneId())
                        .filter(z -> !Boolean.TRUE.equals(z.getDeleted())
                                && Boolean.TRUE.equals(z.getIsActive()))
                        .orElse(shippingService.defaultZone())
                : shippingService.resolveZone(request.getDeliveryAddress());

        BigDecimal shippingFee = shippingService.computeFee(zone, subtotal);

        // 3. Apply coupon if present.
        BigDecimal discountAmount = BigDecimal.ZERO;
        String couponDiscountType = null;
        String couponMessage = null;
        boolean couponApplied = false;
        String couponCode = request.getCouponCode();

        if (couponCode != null && !couponCode.isBlank()) {
            CouponValidateResponseDTO validation = couponService.validate(
                    new CouponValidateRequestDTO(couponCode, subtotal, request.getUserId()));
            if (validation.isValid()) {
                couponApplied = true;
                couponDiscountType = validation.getDiscountType();
                discountAmount = validation.getDiscountAmount() == null
                        ? BigDecimal.ZERO : validation.getDiscountAmount();
                if (validation.isRemovesShipping()) {
                    shippingFee = BigDecimal.ZERO;
                }
            } else {
                couponMessage = validation.getReason();
            }
        }

        // 4. Tax applies on (subtotal - product discount) — shipping is usually excluded.
        BigDecimal taxable = subtotal.subtract(discountAmount);
        if (taxable.signum() < 0) taxable = BigDecimal.ZERO;
        BigDecimal taxAmount = shippingService.computeTax(zone != null ? zone.getId() : null, taxable);

        BigDecimal total = subtotal
                .subtract(discountAmount)
                .add(shippingFee)
                .add(taxAmount);
        if (total.signum() < 0) total = BigDecimal.ZERO;

        return CheckoutQuoteResponseDTO.builder()
                .subtotal(subtotal)
                .shippingFee(shippingFee)
                .taxAmount(taxAmount)
                .discountAmount(discountAmount)
                .total(total)
                .shippingZoneId(zone != null ? zone.getId() : null)
                .shippingZoneName(zone != null ? zone.getDisplayName() : null)
                .couponCode(couponCode)
                .couponDiscountType(couponDiscountType)
                .couponMessage(couponMessage)
                .couponApplied(couponApplied)
                .build();
    }
}
