package kn.org.deliverybackend.service;

import kn.org.deliverybackend.dto.request.product.ProductRequestDTO;
import kn.org.deliverybackend.dto.response.product.ProductResponseDTO;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface ProductService {
    List<ProductResponseDTO> searchProducts(String name);
    List<ProductResponseDTO> getProductsByCategory(Long categoryId);
    List<ProductResponseDTO> getAllProducts();
    Page<ProductResponseDTO> getProductsPaged(int page, int size);
    ProductResponseDTO getProductById(Long id);
    ProductResponseDTO createProduct(ProductRequestDTO productRequestDTO, MultipartFile image);
    ProductResponseDTO updateProduct(Long id, ProductRequestDTO productRequestDTO, MultipartFile image);
    void deleteProduct(Long id);

    /** Up to {@code limit} products in the same category as {@code id}, excluding the caller. */
    List<ProductResponseDTO> getRelatedProducts(Long id, int limit);
}
