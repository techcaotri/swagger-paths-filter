#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Filter Swagger/OpenAPI JSON to keep only specified paths and their dependencies
 * 
 * Usage: node swagger-filter.js input.json output.json [--regex] path1 path2 path3...
 * Example: node swagger-filter.js swagger.json filtered.json /users /users/{id} /products
 * Example with regex: node swagger-filter.js swagger.json filtered.json --regex "/users.*" "/products/\{[^}]+\}"
 */

function findAllSchemaReferences(obj, usedSchemas, visited = new Set()) {
    if (!obj || typeof obj !== 'object') return;
    
    // Prevent infinite recursion
    const objKey = JSON.stringify(obj);
    if (visited.has(objKey)) return;
    visited.add(objKey);

    if (Array.isArray(obj)) {
        obj.forEach(item => findAllSchemaReferences(item, usedSchemas, visited));
        return;
    }

    Object.keys(obj).forEach(key => {
        if (key === '$ref' && typeof obj[key] === 'string') {
            // Extract schema name from $ref
            const ref = obj[key];
            let schemaName = null;
            
            if (ref.startsWith('#/components/schemas/')) {
                schemaName = ref.replace('#/components/schemas/', '');
            } else if (ref.startsWith('#/definitions/')) {
                schemaName = ref.replace('#/definitions/', '');
            }
            
            if (schemaName) {
                usedSchemas.add(schemaName);
            }
        } else {
            findAllSchemaReferences(obj[key], usedSchemas, visited);
        }
    });
}

function filterSwaggerPaths(swagger, pathsToKeep, useRegex = false) {
    console.log(`Filtering ${Object.keys(swagger.paths || {}).length} paths using ${useRegex ? 'regex' : 'exact'} matching...`);
    
    // Create a copy of the original swagger
    const filtered = JSON.parse(JSON.stringify(swagger));
    
    // Filter paths
    const originalPaths = filtered.paths || {};
    const newPaths = {};
    const foundPaths = [];
    const missingPatterns = [];
    
    if (useRegex) {
        // Compile regex patterns
        const regexPatterns = [];
        pathsToKeep.forEach(pattern => {
            try {
                regexPatterns.push({
                    pattern: pattern,
                    regex: new RegExp(pattern)
                });
            } catch (error) {
                console.log(`⚠️  Invalid regex pattern: ${pattern} - ${error.message}`);
                missingPatterns.push(pattern);
            }
        });

        // Test each path against all regex patterns
        Object.keys(originalPaths).forEach(path => {
            const matchingPattern = regexPatterns.find(p => p.regex.test(path));
            if (matchingPattern) {
                newPaths[path] = originalPaths[path];
                foundPaths.push(`${path} (matched by: ${matchingPattern.pattern})`);
            }
        });

        // Check which patterns didn't match anything
        regexPatterns.forEach(pattern => {
            const hasMatch = Object.keys(originalPaths).some(path => pattern.regex.test(path));
            if (!hasMatch) {
                missingPatterns.push(pattern.pattern);
            }
        });
    } else {
        // Exact matching (original behavior)
        pathsToKeep.forEach(pathToKeep => {
            if (originalPaths[pathToKeep]) {
                newPaths[pathToKeep] = originalPaths[pathToKeep];
                foundPaths.push(pathToKeep);
            } else {
                missingPatterns.push(pathToKeep);
            }
        });
    }
    
    filtered.paths = newPaths;
    
    console.log(`✅ Found and kept ${foundPaths.length} paths`);
    if (foundPaths.length <= 10) {
        foundPaths.forEach(path => console.log(`   📍 ${path}`));
    } else {
        foundPaths.slice(0, 10).forEach(path => console.log(`   📍 ${path}`));
        console.log(`   ... and ${foundPaths.length - 10} more paths`);
    }
    
    if (missingPatterns.length > 0) {
        console.log(`⚠️  ${useRegex ? 'Patterns with no matches' : 'Missing paths'}: ${missingPatterns.join(', ')}`);
    }

    // Find all schema references used by the kept paths
    const usedSchemas = new Set();
    console.log('🔍 Finding schema dependencies...');
    findAllSchemaReferences(newPaths, usedSchemas);

    // Handle OpenAPI 3.x schemas
    if (filtered.components?.schemas) {
        const originalSchemaCount = Object.keys(filtered.components.schemas).length;
        const newSchemas = {};
        
        // First pass: add directly referenced schemas
        Object.keys(filtered.components.schemas).forEach(schemaName => {
            if (usedSchemas.has(schemaName)) {
                newSchemas[schemaName] = filtered.components.schemas[schemaName];
            }
        });
        
        // Second pass: find nested references in kept schemas
        let previousSize = 0;
        while (usedSchemas.size > previousSize) {
            previousSize = usedSchemas.size;
            Object.keys(newSchemas).forEach(schemaName => {
                findAllSchemaReferences(newSchemas[schemaName], usedSchemas);
            });
            
            // Add newly found schemas
            Object.keys(filtered.components.schemas).forEach(schemaName => {
                if (usedSchemas.has(schemaName) && !newSchemas[schemaName]) {
                    newSchemas[schemaName] = filtered.components.schemas[schemaName];
                }
            });
        }
        
        filtered.components.schemas = newSchemas;
        console.log(`📦 Schemas: ${originalSchemaCount} → ${Object.keys(newSchemas).length}`);
    }

    // Handle Swagger 2.0 definitions
    if (filtered.definitions) {
        const originalDefCount = Object.keys(filtered.definitions).length;
        const newDefinitions = {};
        
        Object.keys(filtered.definitions).forEach(defName => {
            if (usedSchemas.has(defName)) {
                newDefinitions[defName] = filtered.definitions[defName];
                // Find nested references
                findAllSchemaReferences(filtered.definitions[defName], usedSchemas);
            }
        });
        
        // Second pass for nested references
        Object.keys(filtered.definitions).forEach(defName => {
            if (usedSchemas.has(defName) && !newDefinitions[defName]) {
                newDefinitions[defName] = filtered.definitions[defName];
            }
        });
        
        filtered.definitions = newDefinitions;
        console.log(`📦 Definitions: ${originalDefCount} → ${Object.keys(newDefinitions).length}`);
    }

    return filtered;
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('Usage: node swagger-filter.js <input.json> <output.json> [--regex] <path1> [path2] [path3] ...');
        console.log('       node swagger-filter.js <input.json> <output.json> [--regex] --paths-file <paths.txt>');
        console.log('');
        console.log('Examples:');
        console.log('  Exact matching:');
        console.log('    node swagger-filter.js swagger.json filtered.json /users /users/{id} /products');
        console.log('');
        console.log('  Regex matching:');
        console.log('    node swagger-filter.js swagger.json filtered.json --regex "/users.*" "/products/\\{[^}]+\\}"');
        console.log('');
        console.log('  Using paths file:');
        console.log('    node swagger-filter.js swagger.json filtered.json --paths-file paths.txt');
        console.log('    node swagger-filter.js swagger.json filtered.json --regex --paths-file regex-paths.txt');
        console.log('');
        console.log('Regex examples:');
        console.log('  /users.*           - All paths starting with /users');
        console.log('  /api/v[12]/.*      - Paths for API v1 or v2');
        console.log('  .*/(create|update) - Paths ending with /create or /update');
        console.log('  /products/\\{[^}]+\\} - Product paths with any ID parameter');
        process.exit(1);
    }

    const inputFile = args[0];
    const outputFile = args[1];
    
    let useRegex = false;
    let pathsToKeep;
    let remainingArgs = args.slice(2);
    
    // Check for --regex flag
    if (remainingArgs[0] === '--regex') {
        useRegex = true;
        remainingArgs = remainingArgs.slice(1);
    }
    
    // Check for --paths-file flag
    if (remainingArgs[0] === '--paths-file') {
        if (remainingArgs.length < 2) {
            console.error('Error: --paths-file requires a filename');
            process.exit(1);
        }
        const pathsFile = remainingArgs[1];
        try {
            const pathsContent = fs.readFileSync(pathsFile, 'utf8');
            pathsToKeep = pathsContent.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
        } catch (error) {
            console.error(`Error reading paths file: ${error.message}`);
            process.exit(1);
        }
    } else {
        pathsToKeep = remainingArgs;
    }

    if (!pathsToKeep || pathsToKeep.length === 0) {
        console.error('Error: No paths specified');
        process.exit(1);
    }

    try {
        console.log(`📖 Reading ${inputFile}...`);
        const swaggerContent = fs.readFileSync(inputFile, 'utf8');
        const swagger = JSON.parse(swaggerContent);
        
        console.log(`🎯 ${useRegex ? 'Regex patterns' : 'Paths'} to keep: ${pathsToKeep.join(', ')}`);
        
        const filtered = filterSwaggerPaths(swagger, pathsToKeep, useRegex);
        
        console.log(`💾 Writing filtered result to ${outputFile}...`);
        fs.writeFileSync(outputFile, JSON.stringify(filtered, null, 2));
        
        console.log('✅ Done!');
        console.log(`📊 Summary:`);
        console.log(`   Input paths: ${Object.keys(swagger.paths || {}).length}`);
        console.log(`   Output paths: ${Object.keys(filtered.paths || {}).length}`);
        
        const inputSchemas = swagger.components?.schemas || swagger.definitions || {};
        const outputSchemas = filtered.components?.schemas || filtered.definitions || {};
        console.log(`   Input schemas: ${Object.keys(inputSchemas).length}`);
        console.log(`   Output schemas: ${Object.keys(outputSchemas).length}`);
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Run the script if called directly
if (require.main === module) {
    main();
}

module.exports = { filterSwaggerPaths, findAllSchemaReferences };
