### Step-by-Step with Regex:

1. **Load your Swagger JSON** (upload or paste)

2. **Check the "Enable Regular Expression Matching" checkbox**

3. Enter regex patterns

    in the paths text area, for example:

   ```
   /users.*
   /products/\{[^}]+\}
   ^/api/v[12]/.*
   /.*/(create|update|delete)$
   ```

4. **Click "Filter Swagger JSON"**

5. **Review matched paths** and download the result

## 🛠️ Updated Node.js Script

The Node.js script now supports the `--regex` flag for regex matching.

### Basic Usage:

**Exact matching (original behavior):**

```bash
node swagger-filter.js swagger.json filtered.json /users /products
```

**Regex matching (new feature):**

```bash
node swagger-filter.js swagger.json filtered.json --regex "/users.*" "/products/\{[^}]+\}"
```

**Using paths file with regex:**

```bash
node swagger-filter.js swagger.json filtered.json --regex --paths-file regex-patterns.txt
```

## 📝 Regex Pattern Examples

Here are practical regex patterns you can use:

### Common Patterns:

1. All user-related endpoints:

   ```
   /users.*
   ```

   Matches: 

   ```
   /users
   ```

   ```
   /users/{id}
   ```

   ```
   /users/{id}/profile
   ```

2. Specific API versions:

   ```
   ^/api/v[12]/.*
   ```

   Matches: 

   ```
   /api/v1/anything
   ```

   ```
   /api/v2/anything
   ```

3. CRUD operations:

   ```
   .*/((create|update|delete))$
   ```

   Matches: 

   ```
   /users/create
   ```

   ```
   /products/update
   ```

   ```
   /orders/delete
   ```

4. Paths with ID parameters:

   ```
   /\{[^}]+\}
   ```

   Matches: 

   ```
   /users/{id}
   ```

   ```
   /products/{productId}
   ```

5. Admin endpoints:

   ```
   .*/admin/.*
   ```

   Matches: any path containing 

   ```
   /admin/
   ```

6. Multiple resource types:

   ```
   /(users|products|orders)/.*
   ```

   Matches: all paths starting with 

   ```
   /users/
   ```

   ```
   /products/
   ```

   ```
   /orders/
   ```

### Complex Examples:

**E-commerce API filtering:**

```bash
# Keep only user management and product catalog
node swagger-filter.js ecommerce.json filtered.json --regex "/users.*" "/products.*" "/auth/.*"
```

**Microservice extraction:**

```bash
# Extract user service endpoints
node swagger-filter.js monolith.json user-service.json --regex "^/api/v1/users.*" "^/auth/.*"
```

**Version-specific filtering:**

```bash
# Keep only v2 API endpoints
node swagger-filter.js api.json v2-only.json --regex "^/api/v2/.*"
```

## 📄 Using Paths Files with Regex

Create a text file (e.g., `patterns.txt`) with your regex patterns:

```
# User management endpoints
/users.*

# Product endpoints with IDs
/products/\{[^}]+\}.*

# All v1 and v2 API endpoints
^/api/v[12]/.*

# Authentication endpoints
/auth/.*
```

Then run:

```bash
node swagger-filter.js swagger.json filtered.json --regex --paths-file patterns.txt
```

## ⚠️ Important Regex Notes:

1. Escaping

   : In command line, escape special characters:

   - `\{` for literal `{`
   - `\\` for literal `\`

2. **Testing**: Use the web tool first to test your regex patterns before using the command line

3. **Case sensitivity**: Regex patterns are case-sensitive by default

4. **Performance**: Complex regex patterns may take longer to process large APIs

## 🎯 Migration Guide

**From exact matching to regex:**

**Before (exact):**

```
/users
/users/{id}
/users/{id}/profile
/users/{id}/settings
```

**After (regex):**

```
/users.*
```

**Before (multiple exact paths):**

```
/api/v1/users
/api/v1/products
/api/v1/orders
```

**After (single regex):**

```
^/api/v1/(users|products|orders).*
```

The regex support makes the tool much more powerful and flexible for filtering large APIs! You can now easily extract entire feature sets, API versions, or resource categories with simple patterns.