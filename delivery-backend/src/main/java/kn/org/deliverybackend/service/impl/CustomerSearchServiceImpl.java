package kn.org.deliverybackend.service.impl;

import kn.org.deliverybackend.dto.response.search.CustomerSearchResponse;
import kn.org.deliverybackend.dto.response.search.SearchGroup;
import kn.org.deliverybackend.dto.response.search.SearchItem;
import kn.org.deliverybackend.entity.Category;
import kn.org.deliverybackend.entity.Product;
import kn.org.deliverybackend.entity.PromotionalBanner;
import kn.org.deliverybackend.entity.Shop;
import kn.org.deliverybackend.repository.CategoryRepository;
import kn.org.deliverybackend.repository.ProductRepository;
import kn.org.deliverybackend.repository.PromotionalBannerRepository;
import kn.org.deliverybackend.repository.ShopRepository;
import kn.org.deliverybackend.service.CustomerSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CustomerSearchServiceImpl implements CustomerSearchService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final ShopRepository shopRepository;
    private final PromotionalBannerRepository promotionalBannerRepository;

    @Override
    @Transactional(readOnly = true)
    public CustomerSearchResponse search(String query, int limit) {
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) {
            return CustomerSearchResponse.builder()
                    .query(q)
                    .products(SearchGroup.empty())
                    .categories(SearchGroup.empty())
                    .shops(SearchGroup.empty())
                    .banners(SearchGroup.empty())
                    .totalCount(0L)
                    .build();
        }

        int safeLimit = Math.min(Math.max(limit, 1), 50);
        Pageable pageable = PageRequest.of(0, safeLimit);

        SearchGroup products = toProducts(productRepository.searchCustomer(q, pageable));
        SearchGroup categories = toCategories(categoryRepository.searchCustomer(q, pageable));
        SearchGroup shops = toShops(shopRepository.search(q, pageable));
        SearchGroup banners = toBanners(promotionalBannerRepository.searchCustomerActive(q, LocalDate.now(), pageable));

        long total = products.getTotal() + categories.getTotal() + shops.getTotal() + banners.getTotal();

        return CustomerSearchResponse.builder()
                .query(q)
                .products(products)
                .categories(categories)
                .shops(shops)
                .banners(banners)
                .totalCount(total)
                .build();
    }

    private SearchGroup toProducts(Page<Product> page) {
        List<SearchItem> items = page.getContent().stream().map(p -> {
            Map<String, Object> extra = new LinkedHashMap<>();
            extra.put("price", p.getPrice());
            if (p.getDiscountPrice() != null) extra.put("discountPrice", p.getDiscountPrice());
            extra.put("avgRating", p.getAvgRating());
            extra.put("totalReviews", p.getTotalReviews());
            if (p.getUnit() != null) extra.put("unit", p.getUnit());
            return SearchItem.builder()
                    .id(String.valueOf(p.getId()))
                    .type("PRODUCT")
                    .title(p.getName())
                    .subtitle(p.getDescription())
                    .imageUrl(p.getImageUrl())
                    .extra(extra)
                    .build();
        }).toList();
        return SearchGroup.builder().items(items).total(page.getTotalElements()).build();
    }

    private SearchGroup toCategories(Page<Category> page) {
        List<SearchItem> items = page.getContent().stream().map(c -> SearchItem.builder()
                .id(String.valueOf(c.getId()))
                .type("CATEGORY")
                .title(c.getName())
                .build()).toList();
        return SearchGroup.builder().items(items).total(page.getTotalElements()).build();
    }

    private SearchGroup toShops(Page<Shop> page) {
        List<SearchItem> items = page.getContent().stream().map(s -> SearchItem.builder()
                .id(String.valueOf(s.getId()))
                .type("SHOP")
                .title(s.getName())
                .subtitle(s.getLocation())
                .build()).toList();
        return SearchGroup.builder().items(items).total(page.getTotalElements()).build();
    }

    private SearchGroup toBanners(Page<PromotionalBanner> page) {
        List<SearchItem> items = page.getContent().stream().map(b -> {
            Map<String, Object> extra = new LinkedHashMap<>();
            if (b.getFromDate() != null) extra.put("fromDate", b.getFromDate().toString());
            if (b.getToDate() != null) extra.put("toDate", b.getToDate().toString());
            return SearchItem.builder()
                    .id(b.getId().toString())
                    .type("BANNER")
                    .title(b.getPromotionTitle())
                    .subtitle(b.getPromotionDetails())
                    .imageUrl(b.getImageUrl())
                    .extra(extra)
                    .build();
        }).toList();
        return SearchGroup.builder().items(items).total(page.getTotalElements()).build();
    }
}
