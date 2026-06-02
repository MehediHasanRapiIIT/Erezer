package kn.org.deliverybackend.dto.response.search;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CustomerSearchResponse {
    private String query;
    private SearchGroup products;
    private SearchGroup categories;
    private SearchGroup shops;
    private SearchGroup banners;
    private long totalCount;
}
