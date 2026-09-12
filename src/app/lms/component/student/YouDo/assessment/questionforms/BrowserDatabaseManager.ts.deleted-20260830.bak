// BrowserDatabaseManager.ts

// Browser-based database storage with improved functionality
export interface BrowserDatabase {
  name: string;
  tables: BrowserTable[];
  createdAt: Date;
  lastModified: Date;
  version: number;
  description?: string;
}

export interface BrowserTable {
  name: string;
  columns: BrowserColumn[];
  data: any[];
  indexes: string[];
  constraints: TableConstraint[];
  description?: string;
  engine?: string;
  charset?: string;
}

export interface BrowserColumn {
  name: string;
  type: 'VARCHAR' | 'INT' | 'BIGINT' | 'DECIMAL' | 'FLOAT' | 'DOUBLE' | 'DATE' | 'DATETIME' | 'TIMESTAMP' | 'TIME' | 'YEAR' | 'TEXT' | 'LONGTEXT' | 'BOOLEAN' | 'BLOB' | 'JSON' | 'ENUM' | 'SET';
  length?: number;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: any;
  autoIncrement: boolean;
  unique: boolean;
  foreignKey?: ForeignKeyConstraint;
  unsigned?: boolean;
  zerofill?: boolean;
  collation?: string;
  comment?: string;
}

export interface TableConstraint {
  type: 'PRIMARY_KEY' | 'FOREIGN_KEY' | 'UNIQUE' | 'CHECK' | 'INDEX';
  name: string;
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface ForeignKeyConstraint {
  referencedTable: string;
  referencedColumn: string;
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  result: string;
  timestamp: Date;
  success: boolean;
  executionTime: number;
  rowCount?: number;
  affectedRows?: number;
}

export interface QueryResultView {
  id: string;
  name: string;
  type: 'table' | 'chart' | 'text';
  data: any[];
  columns?: string[];
  chartType?: 'bar' | 'line' | 'pie';
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime?: number;
  memory?: number;
  resultSet?: any[];
  affectedRows?: number;
  columns?: string[];
  queryType?: string;
  rowCount?: number;
  sqlMessage?: string;
  message?: string;
  database?: string;
  warnings?: string[];
}

// Browser Database Manager - ENHANCED VERSION
export class BrowserDatabaseManager {
  private static STORAGE_KEY = 'browser_databases_v2';
  private static CURRENT_DB_KEY = 'current_browser_database_v2';
  private static QUERY_HISTORY_KEY = 'query_history_v2';
  private static QUERY_VIEWS_KEY = 'query_views_v2';

  // MySQL data types mapping
  static readonly MYSQL_TYPES = [
    'INT', 'VARCHAR', 'TEXT', 'DATE', 'DATETIME', 'TIMESTAMP',
    'DECIMAL', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'BLOB', 'JSON',
    'ENUM', 'SET', 'BIGINT', 'TIME', 'YEAR', 'LONGTEXT'
  ];

  static getDatabases(): BrowserDatabase[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        // Create sample database if none exists
        const sampleDb = this.createSampleDatabase();
        return [sampleDb];
      }

      const databases = JSON.parse(stored);
      return databases.map((db: any) => ({
        ...db,
        createdAt: new Date(db.createdAt),
        lastModified: new Date(db.lastModified),
        tables: db.tables.map((table: any) => ({
          ...table,
          data: table.data.map((row: any) => {
            const processedRow: any = {};
            Object.keys(row).forEach(key => {
              if (typeof row[key] === 'string' && row[key].includes('T') && row[key].includes('Z')) {
                processedRow[key] = new Date(row[key]);
              } else {
                processedRow[key] = row[key];
              }
            });
            return processedRow;
          })
        }))
      }));
    } catch (error) {
      console.error('Error reading databases from storage:', error);
      const sampleDb = this.createSampleDatabase();
      return [sampleDb];
    }
  }

  static createSampleDatabase(): BrowserDatabase {
    const sampleDb: BrowserDatabase = {
      name: 'lms_sample_db',
      description: 'Sample LMS database with users and courses',
      tables: [
        {
          name: 'users',
          columns: [
            {
              name: 'id',
              type: 'INT',
              nullable: false,
              primaryKey: true,
              autoIncrement: true,
              unique: true
            },
            {
              name: 'name',
              type: 'VARCHAR',
              length: 100,
              nullable: false,
              primaryKey: false,
              autoIncrement: false,
              unique: false
            },
            {
              name: 'email',
              type: 'VARCHAR',
              length: 100,
              nullable: false,
              primaryKey: false,
              autoIncrement: false,
              unique: true
            },
            {
              name: 'age',
              type: 'INT',
              nullable: true,
              primaryKey: false,
              autoIncrement: false,
              unique: false
            },
            {
              name: 'city',
              type: 'VARCHAR',
              length: 50,
              nullable: true,
              primaryKey: false,
              autoIncrement: false,
              unique: false
            },
            {
              name: 'course',
              type: 'VARCHAR',
              length: 50,
              nullable: true,
              primaryKey: false,
              autoIncrement: false,
              unique: false
            },
            {
              name: 'created_at',
              type: 'TIMESTAMP',
              nullable: false,
              primaryKey: false,
              autoIncrement: false,
              unique: false,
              defaultValue: 'CURRENT_TIMESTAMP'
            }
          ],
          data: [
            { id: 1, name: 'John Doe', email: 'john@example.com', age: 25, city: 'New York', course: 'Computer Science', created_at: new Date('2024-01-15') },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 30, city: 'London', course: 'Data Science', created_at: new Date('2024-01-16') },
            { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 28, city: 'Tokyo', course: 'Web Development', created_at: new Date('2024-01-17') },
            { id: 4, name: 'Alice Brown', email: 'alice@example.com', age: 22, city: 'Paris', course: 'AI/ML', created_at: new Date('2024-01-18') },
            { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', age: 35, city: 'Berlin', course: 'Cybersecurity', created_at: new Date('2024-01-19') }
          ],
          indexes: ['idx_email'],
          constraints: [
            {
              type: 'PRIMARY_KEY',
              name: 'PRIMARY',
              columns: ['id']
            },
            {
              type: 'UNIQUE',
              name: 'unique_email',
              columns: ['email']
            }
          ],
          engine: 'InnoDB',
          charset: 'utf8mb4'
        },
        {
          name: 'courses',
          columns: [
            {
              name: 'course_id',
              type: 'INT',
              nullable: false,
              primaryKey: true,
              autoIncrement: true,
              unique: true
            },
            {
              name: 'course_name',
              type: 'VARCHAR',
              length: 100,
              nullable: false,
              primaryKey: false,
              autoIncrement: false,
              unique: false
            },
            {
              name: 'instructor',
              type: 'VARCHAR',
              length: 100,
              nullable: false,
              primaryKey: false,
              autoIncrement: false,
              unique: false
            },
            {
              name: 'duration_weeks',
              type: 'INT',
              nullable: false,
              primaryKey: false,
              autoIncrement: false,
              unique: false
            },
            {
              name: 'price',
              type: 'DECIMAL',
              length: 10,
              nullable: false,
              primaryKey: false,
              autoIncrement: false,
              unique: false
            },
            {
              name: 'enrollment_count',
              type: 'INT',
              nullable: false,
              primaryKey: false,
              autoIncrement: false,
              unique: false,
              defaultValue: 0
            }
          ],
          data: [
            { course_id: 1, course_name: 'Introduction to Programming', instructor: 'Dr. Smith', duration_weeks: 12, price: 299.99, enrollment_count: 45 },
            { course_id: 2, course_name: 'Data Science Fundamentals', instructor: 'Dr. Johnson', duration_weeks: 16, price: 499.99, enrollment_count: 32 },
            { course_id: 3, course_name: 'Web Development Bootcamp', instructor: 'Prof. Williams', duration_weeks: 20, price: 799.99, enrollment_count: 28 },
            { course_id: 4, course_name: 'Machine Learning Advanced', instructor: 'Dr. Brown', duration_weeks: 24, price: 999.99, enrollment_count: 18 }
          ],
          indexes: ['idx_instructor'],
          constraints: [
            {
              type: 'PRIMARY_KEY',
              name: 'PRIMARY',
              columns: ['course_id']
            }
          ],
          engine: 'InnoDB',
          charset: 'utf8mb4'
        }
      ],
      createdAt: new Date(),
      lastModified: new Date(),
      version: 1
    };

    this.saveDatabases([sampleDb]);
    return sampleDb;
  }

  static saveDatabases(databases: BrowserDatabase[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(databases));
    } catch (error) {
      console.error('Error saving databases to storage:', error);
    }
  }

  static getCurrentDatabase(): BrowserDatabase | null {
    try {
      const currentDbName = localStorage.getItem(this.CURRENT_DB_KEY);
      if (!currentDbName) {
        const databases = this.getDatabases();
        if (databases.length > 0) {
          this.setCurrentDatabase(databases[0].name);
          return databases[0];
        }
        return null;
      }

      const databases = this.getDatabases();
      return databases.find(db => db.name === currentDbName) || databases[0] || null;
    } catch (error) {
      console.error('Error getting current database:', error);
      return null;
    }
  }

  static setCurrentDatabase(name: string): void {
    try {
      localStorage.setItem(this.CURRENT_DB_KEY, name);
    } catch (error) {
      console.error('Error setting current database:', error);
    }
  }

  static getQueryHistory(): QueryHistoryItem[] {
    try {
      const stored = localStorage.getItem(this.QUERY_HISTORY_KEY);
      if (!stored) return [];

      const history = JSON.parse(stored);
      return history.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
    } catch (error) {
      console.error('Error reading query history:', error);
      return [];
    }
  }

  static saveQueryHistory(history: QueryHistoryItem[]): void {
    try {
      // Keep only last 100 items
      const limitedHistory = history.slice(0, 100);
      localStorage.setItem(this.QUERY_HISTORY_KEY, JSON.stringify(limitedHistory));
    } catch (error) {
      console.error('Error saving query history:', error);
    }
  }

  static addToHistory(item: QueryHistoryItem): void {
    const history = this.getQueryHistory();
    history.unshift(item);
    this.saveQueryHistory(history);
  }

  static clearHistory(): void {
    localStorage.removeItem(this.QUERY_HISTORY_KEY);
  }

  static getQueryViews(): QueryResultView[] {
    try {
      const stored = localStorage.getItem(this.QUERY_VIEWS_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error reading query views:', error);
      return [];
    }
  }

  static saveQueryViews(views: QueryResultView[]): void {
    try {
      localStorage.setItem(this.QUERY_VIEWS_KEY, JSON.stringify(views));
    } catch (error) {
      console.error('Error saving query views:', error);
    }
  }

  static createDatabase(name: string, description?: string): BrowserDatabase {
    const databases = this.getDatabases();

    // Check if database already exists
    const existingDb = databases.find(db => db.name === name);
    if (existingDb) {
      return existingDb;
    }

    const newDatabase: BrowserDatabase = {
      name,
      description,
      tables: [],
      createdAt: new Date(),
      lastModified: new Date(),
      version: 1
    };

    databases.push(newDatabase);
    this.saveDatabases(databases);
    this.setCurrentDatabase(name);

    return newDatabase;
  }

  static deleteDatabase(name: string): boolean {
    const databases = this.getDatabases();
    const filtered = databases.filter(db => db.name !== name);

    if (filtered.length === databases.length) {
      return false; // Database not found
    }

    this.saveDatabases(filtered);

    // If we're deleting the current database, clear current
    const current = this.getCurrentDatabase();
    if (current && current.name === name) {
      localStorage.removeItem(this.CURRENT_DB_KEY);
    }

    return true;
  }

  static exportDatabase(name: string): string {
    const databases = this.getDatabases();
    const database = databases.find(db => db.name === name);

    if (!database) {
      throw new Error(`Database "${name}" not found`);
    }

    return JSON.stringify(database, null, 2);
  }

  static importDatabase(data: string): BrowserDatabase {
    try {
      const importedDb = JSON.parse(data);

      // Validate structure
      if (!importedDb.name || !Array.isArray(importedDb.tables)) {
        throw new Error('Invalid database format');
      }

      const databases = this.getDatabases();

      // Check if database already exists
      const existingIndex = databases.findIndex(db => db.name === importedDb.name);
      if (existingIndex !== -1) {
        // Update existing database
        databases[existingIndex] = {
          ...importedDb,
          lastModified: new Date(),
          createdAt: new Date(importedDb.createdAt || new Date())
        };
      } else {
        // Add new database
        databases.push({
          ...importedDb,
          createdAt: new Date(importedDb.createdAt || new Date()),
          lastModified: new Date(),
          version: importedDb.version || 1
        });
      }

      this.saveDatabases(databases);
      this.setCurrentDatabase(importedDb.name);

      return this.getCurrentDatabase()!;
    } catch (error) {
      console.error('Error importing database:', error);
      throw new Error('Failed to import database');
    }
  }

  static executeQuery(databaseName: string, query: string): ExecutionResult {
    const startTime = performance.now();
    const databases = this.getDatabases();
    const database = databases.find(db => db.name === databaseName);

    if (!database) {
      return {
        success: false,
        output: '',
        error: `Database "${databaseName}" not found`,
        executionTime: performance.now() - startTime
      };
    }

    try {
      // Clean and normalize the query
      let cleanQuery = query
        .trim()
        .replace(/--.*$/gm, '') // Remove single line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/;$/, ''); // Remove trailing semicolon

      // Handle empty queries
      if (!cleanQuery.trim()) {
        return {
          success: false,
          output: '',
          error: 'Empty query',
          executionTime: performance.now() - startTime
        };
      }

      const normalizedQuery = cleanQuery.toUpperCase().trim();

      // Parse query type
      let result: ExecutionResult;

      if (normalizedQuery.startsWith('SELECT')) {
        result = this.executeSelectQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('CREATE TABLE')) {
        result = this.executeCreateTableQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('INSERT INTO')) {
        result = this.executeInsertQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('UPDATE')) {
        result = this.executeUpdateQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('DELETE FROM')) {
        result = this.executeDeleteQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('DROP TABLE')) {
        result = this.executeDropTableQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('SHOW TABLES')) {
        result = this.executeShowTablesQuery(database);
      } else if (normalizedQuery.startsWith('DESCRIBE') || normalizedQuery.startsWith('DESC')) {
        result = this.executeDescribeQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('ALTER TABLE')) {
        result = this.executeAlterTableQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('TRUNCATE TABLE')) {
        result = this.executeTruncateTableQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('CREATE DATABASE')) {
        result = this.executeCreateDatabaseQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('DROP DATABASE')) {
        result = this.executeDropDatabaseQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('USE')) {
        result = this.executeUseQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('SHOW DATABASES')) {
        result = this.executeShowDatabasesQuery();
      } else if (normalizedQuery.startsWith('EXPLAIN')) {
        result = this.executeExplainQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('CREATE INDEX')) {
        result = this.executeCreateIndexQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('DROP INDEX')) {
        result = this.executeDropIndexQuery(database, cleanQuery);
      } else if (normalizedQuery.startsWith('BEGIN') || normalizedQuery.startsWith('START TRANSACTION')) {
        result = this.executeBeginTransaction(database);
      } else if (normalizedQuery.startsWith('COMMIT')) {
        result = this.executeCommitTransaction(database);
      } else if (normalizedQuery.startsWith('ROLLBACK')) {
        result = this.executeRollbackTransaction(database);
      } else {
        result = {
          success: false,
          output: '',
          error: `Unsupported query type. Supported: SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, SHOW, DESCRIBE, TRUNCATE, EXPLAIN, USE, BEGIN, COMMIT, ROLLBACK`,
          queryType: 'UNKNOWN'
        };
      }

      const endTime = performance.now();
      result.executionTime = endTime - startTime;
      result.memory = Math.random() * 10 + 1;
      result.database = database.name;

      // Add to history if successful or error
      if (result.queryType && result.queryType !== 'UNKNOWN') {
        this.addToHistory({
          id: Date.now().toString(),
          query: cleanQuery.substring(0, 200) + (cleanQuery.length > 200 ? '...' : ''),
          result: result.success ? '✅ Success' : '❌ Error',
          timestamp: new Date(),
          success: result.success,
          executionTime: result.executionTime,
          rowCount: result.rowCount,
          affectedRows: result.affectedRows
        });
      }

      // Update database if modified
      if (result.success && result.queryType && ['CREATE', 'DROP', 'ALTER', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'].includes(result.queryType)) {
        database.lastModified = new Date();
        this.saveDatabase(database);
      }

      return result;

    } catch (error) {
      console.error('Query execution error:', error);
      return {
        success: false,
        output: '',
        error: `Query execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: performance.now() - startTime
      };
    }
  }

  private static executeSelectQuery(database: BrowserDatabase, query: string): ExecutionResult {
    try {
      // Extract table name(s) - handle joins
      const fromMatch = query.match(/FROM\s+([^\s;,(]+)/i);
      if (!fromMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid SELECT query: No FROM clause found',
          queryType: 'SELECT'
        };
      }

      const tableName = fromMatch[1].trim().replace(/[`"']/g, '');
      const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());

      if (!table) {
        return {
          success: false,
          output: '',
          error: `Table "${tableName}" does not exist`,
          queryType: 'SELECT'
        };
      }

      // Parse SELECT clause
      const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i) || query.match(/SELECT\s+(.+)$/i);
      if (!selectMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid SELECT clause',
          queryType: 'SELECT'
        };
      }

      const selectClause = selectMatch[1].trim();
      let columns: string[] = [];

      if (selectClause === '*') {
        columns = table.columns.map(col => col.name);
      } else {
        columns = selectClause.split(',')
          .map(col => col.trim().split(/\s+as\s+/i)[0].replace(/[`"']/g, ''))
          .filter(col => col);
      }

      // Validate columns
      const validColumns = columns.filter(col =>
        table.columns.some(tableCol => tableCol.name.toLowerCase() === col.toLowerCase())
      );

      if (validColumns.length === 0 && columns.length > 0) {
        return {
          success: false,
          output: '',
          error: `Invalid column(s) specified. Available columns: ${table.columns.map(c => c.name).join(', ')}`,
          queryType: 'SELECT'
        };
      }

      // Start with all data
      let resultData = [...table.data];

      // Parse WHERE clause
      const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+(ORDER BY|GROUP BY|LIMIT|HAVING|$))/i) ||
        query.match(/WHERE\s+(.+)$/i);

      if (whereMatch) {
        const condition = whereMatch[1].trim();
        resultData = this.filterDataWithWhere(table, resultData, condition);
      }

      // Parse GROUP BY clause
      const groupByMatch = query.match(/GROUP BY\s+([^;]+?)(?:\s+(ORDER BY|LIMIT|HAVING|$))/i) ||
        query.match(/GROUP BY\s+([^;]+)$/i);

      if (groupByMatch) {
        const groupByColumns = groupByMatch[1].split(',').map(col => col.trim().replace(/[`"']/g, ''));
        resultData = this.groupData(table, resultData, groupByColumns, columns);
      }

      // Parse ORDER BY clause
      const orderByMatch = query.match(/ORDER BY\s+([^;]+?)(?:\s+(LIMIT|$))/i) ||
        query.match(/ORDER BY\s+([^;]+)$/i);

      if (orderByMatch) {
        const orderClause = orderByMatch[1];
        resultData = this.sortData(table, resultData, orderClause);
      }

      // Parse LIMIT clause
      const limitMatch = query.match(/LIMIT\s+(\d+)(?:\s*,\s*(\d+))?/i);
      if (limitMatch) {
        const offset = limitMatch[2] ? parseInt(limitMatch[1]) : 0;
        const limit = limitMatch[2] ? parseInt(limitMatch[2]) : parseInt(limitMatch[1]);
        resultData = resultData.slice(offset, offset + limit);
      }

      // Prepare final result with only selected columns
      const finalResult = resultData.map(row => {
        const resultRow: any = {};
        (validColumns.length > 0 ? validColumns : table.columns.map(c => c.name)).forEach(col => {
          const actualColumn = table.columns.find(c => c.name.toLowerCase() === col.toLowerCase());
          if (actualColumn) {
            resultRow[actualColumn.name] = row[actualColumn.name];
          }
        });
        return resultRow;
      });

      return {
        success: true,
        output: 'SELECT query executed successfully',
        resultSet: finalResult,
        columns: validColumns.length > 0 ? validColumns : table.columns.map(c => c.name),
        rowCount: finalResult.length,
        queryType: 'SELECT'
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: `SELECT query error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queryType: 'SELECT'
      };
    }
  }

  private static filterDataWithWhere(table: BrowserTable, data: any[], whereCondition: string): any[] {
    try {
      // Simple WHERE condition parser
      // Supports: =, !=, >, <, >=, <=, LIKE, IN, AND, OR
      const conditions = whereCondition.split(/\s+(?:AND|OR)\s+/i);
      const operators = whereCondition.match(/\s+(?:AND|OR)\s+/gi) || [];

      return data.filter(row => {
        let result = this.evaluateSimpleCondition(row, conditions[0], table);

        for (let i = 1; i < conditions.length; i++) {
          const op = operators[i - 1]?.trim().toUpperCase();
          const conditionResult = this.evaluateSimpleCondition(row, conditions[i], table);

          if (op === 'AND') {
            result = result && conditionResult;
          } else if (op === 'OR') {
            result = result || conditionResult;
          }
        }

        return result;
      });
    } catch (error) {
      console.error('Error filtering data:', error);
      return data;
    }
  }

  private static evaluateSimpleCondition(row: any, condition: string, table: BrowserTable): boolean {
    // Remove parentheses
    condition = condition.replace(/[()]/g, '').trim();

    // Check for IN condition
    const inMatch = condition.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
    if (inMatch) {
      const column = inMatch[1];
      const values = inMatch[2].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
      const rowValue = row[column];
      return values.some(v => this.compareValues(rowValue, v));
    }

    // Check for LIKE condition
    const likeMatch = condition.match(/(\w+)\s+LIKE\s+(['"][^'"]+['"])/i);
    if (likeMatch) {
      const column = likeMatch[1];
      const pattern = likeMatch[2].replace(/^['"]|['"]$/g, '').replace(/%/g, '.*').replace(/_/g, '.');
      const regex = new RegExp(`^${pattern}$`, 'i');
      const rowValue = String(row[column] || '');
      return regex.test(rowValue);
    }

    // Check for comparison operators
    const comparisonMatch = condition.match(/(\w+)\s*(=|!=|>|<|>=|<=|<>)\s*(['"][^'"]*['"]|[^'"]\w*)/i);
    if (comparisonMatch) {
      const column = comparisonMatch[1];
      const operator = comparisonMatch[2];
      const value = comparisonMatch[3].replace(/^['"]|['"]$/g, '');
      const rowValue = row[column];

      switch (operator) {
        case '=': return this.compareValues(rowValue, value);
        case '!=': case '<>': return !this.compareValues(rowValue, value);
        case '>': return this.greaterThan(rowValue, value);
        case '<': return this.lessThan(rowValue, value);
        case '>=': return this.compareValues(rowValue, value) || this.greaterThan(rowValue, value);
        case '<=': return this.compareValues(rowValue, value) || this.lessThan(rowValue, value);
        default: return true;
      }
    }

    return true;
  }

  private static compareValues(a: any, b: any): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;

    // Try numeric comparison
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA === numB;
    }

    // String comparison (case-insensitive)
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  private static greaterThan(a: any, b: any): boolean {
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA > numB;
    }
    return String(a).toLowerCase() > String(b).toLowerCase();
  }

  private static lessThan(a: any, b: any): boolean {
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA < numB;
    }
    return String(a).toLowerCase() < String(b).toLowerCase();
  }

  private static groupData(table: BrowserTable, data: any[], groupByColumns: string[], selectColumns: string[]): any[] {
    // Simple grouping - just return unique groups
    const groups = new Map<string, any>();

    data.forEach(row => {
      const groupKey = groupByColumns.map(col => row[col]).join('|');
      if (!groups.has(groupKey)) {
        const groupRow: any = {};
        selectColumns.forEach(col => {
          groupRow[col] = row[col];
        });
        groups.set(groupKey, groupRow);
      }
    });

    return Array.from(groups.values());
  }

  private static sortData(table: BrowserTable, data: any[], orderClause: string): any[] {
    const sortSpecs = orderClause.split(',').map(spec => {
      const parts = spec.trim().split(/\s+/);
      return {
        column: parts[0].replace(/[`"']/g, ''),
        direction: (parts[1] || 'ASC').toUpperCase()
      };
    });

    return [...data].sort((a, b) => {
      for (const spec of sortSpecs) {
        const valA = a[spec.column];
        const valB = b[spec.column];

        // Handle nulls
        if (valA == null && valB == null) continue;
        if (valA == null) return spec.direction === 'ASC' ? -1 : 1;
        if (valB == null) return spec.direction === 'ASC' ? 1 : -1;

        const comparison = this.compareForSort(valA, valB);
        if (comparison !== 0) {
          return spec.direction === 'DESC' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  private static compareForSort(a: any, b: any): number {
    // Try numeric comparison first
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }

    // String comparison
    return String(a).localeCompare(String(b));
  }

  private static executeCreateTableQuery(database: BrowserDatabase, query: string): ExecutionResult {
    try {
      console.log('🔧 STARTING CREATE TABLE PARSING');
      console.log('📝 Original query:', query);

      // Clean and normalize the query
      let cleanQuery = query
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();

      console.log('🧹 Cleaned query:', cleanQuery);

      // Extract table name - match CREATE TABLE <name> (
      const tableNameMatch = cleanQuery.match(/CREATE\s+TABLE\s+(\w+)\s*\(/i);
      if (!tableNameMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid CREATE TABLE syntax: Could not find table name',
          queryType: 'CREATE'
        };
      }

      const tableName = tableNameMatch[1].trim();
      console.log('📋 Table name found:', tableName);

      // Check if table already exists
      if (database.tables.some(t => t.name.toLowerCase() === tableName.toLowerCase())) {
        return {
          success: false,
          output: '',
          error: `Table "${tableName}" already exists`,
          queryType: 'CREATE'
        };
      }

      // Find the content between the first '(' and the last ')'
      const startIndex = cleanQuery.indexOf('(');
      const endIndex = cleanQuery.lastIndexOf(')');

      if (startIndex === -1 || endIndex === -1) {
        return {
          success: false,
          output: '',
          error: 'Invalid CREATE TABLE syntax: Missing parentheses',
          queryType: 'CREATE'
        };
      }

      let columnsContent = cleanQuery.substring(startIndex + 1, endIndex).trim();
      console.log('📄 Columns content:', columnsContent);

      // Remove ENGINE and CHARSET if present at the end
      columnsContent = columnsContent.replace(/\s*ENGINE\s*=\s*\w+/gi, '');
      columnsContent = columnsContent.replace(/\s*DEFAULT\s*CHARSET\s*=\s*\w+/gi, '');
      columnsContent = columnsContent.trim();

      console.log('🧹 Clean columns content:', columnsContent);

      // SPLIT COLUMNS MANUALLY - This is the key fix!
      const columns: BrowserColumn[] = [];
      let currentColumn = '';
      let parenDepth = 0;
      let inQuotes = false;
      let quoteChar = '';

      for (let i = 0; i < columnsContent.length; i++) {
        const char = columnsContent[i];

        // Handle quotes
        if ((char === "'" || char === '"') && (i === 0 || columnsContent[i - 1] !== '\\')) {
          if (!inQuotes) {
            inQuotes = true;
            quoteChar = char;
          } else if (char === quoteChar) {
            inQuotes = false;
          }
          currentColumn += char;
        }
        // Handle parentheses (for data types like VARCHAR(100))
        else if (char === '(' && !inQuotes) {
          parenDepth++;
          currentColumn += char;
        }
        else if (char === ')' && !inQuotes) {
          parenDepth--;
          currentColumn += char;
        }
        // Handle column separator (comma) when not in quotes or parentheses
        else if (char === ',' && !inQuotes && parenDepth === 0) {
          if (currentColumn.trim()) {
            console.log('🔍 Found column definition:', currentColumn.trim());
            const column = this.parseColumnDefinition(currentColumn.trim());
            if (column) {
              columns.push(column);
            }
          }
          currentColumn = '';
        }
        else {
          currentColumn += char;
        }
      }

      // Don't forget the last column
      if (currentColumn.trim()) {
        console.log('🔍 Found last column definition:', currentColumn.trim());
        const column = this.parseColumnDefinition(currentColumn.trim());
        if (column) {
          columns.push(column);
        }
      }

      console.log(`✅ Total columns parsed: ${columns.length}`);
      console.log('📊 Column names:', columns.map(c => c.name));

      if (columns.length === 0) {
        return {
          success: false,
          output: '',
          error: 'No columns found in CREATE TABLE statement',
          queryType: 'CREATE'
        };
      }

      const newTable: BrowserTable = {
        name: tableName,
        columns,
        data: [],
        indexes: [],
        constraints: [],
        engine: 'InnoDB',
        charset: 'utf8mb4'
      };

      database.tables.push(newTable);
      this.saveDatabase(database);

      return {
        success: false, // Changed to false to see error message
        output: '',
        error: `DEBUG: Table "${tableName}" created with ${columns.length} columns: ${columns.map(c => c.name).join(', ')}`,
        queryType: 'CREATE'
      };

    } catch (error) {
      console.error('❌ CREATE TABLE error:', error);
      return {
        success: false,
        output: '',
        error: `CREATE TABLE error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queryType: 'CREATE'
      };
    }
  }

  // ADD THIS NEW HELPER METHOD:
  private static parseColumnDefinition(def: string): BrowserColumn | null {
    console.log('🧠 Parsing column definition:', def);

    // Skip if it's a constraint
    const upperDef = def.toUpperCase();
    if (upperDef.includes('PRIMARY KEY') ||
      upperDef.includes('FOREIGN KEY') ||
      upperDef.includes('UNIQUE KEY') ||
      upperDef.includes('CHECK') ||
      upperDef.includes('CONSTRAINT')) {
      console.log('⏭️ Skipping constraint:', def);
      return null;
    }

    // Parse column definition pattern: name type [constraints]
    // Try multiple patterns

    // Pattern 1: name type
    let match = def.match(/^(\w+)\s+(\w+(?:\(\d+(?:,\s*\d+)?\))?)/i);

    // Pattern 2: `name` type
    if (!match) {
      match = def.match(/^[`"']?(\w+)[`"']?\s+(\w+(?:\(\d+(?:,\s*\d+)?\))?)/i);
    }

    if (!match) {
      console.warn('❌ Could not parse column:', def);
      return null;
    }

    const name = match[1];
    const dataType = match[2].toUpperCase();
    const rest = def.substring(match[0].length).trim();

    console.log(`✅ Basic parse: name="${name}", type="${dataType}", rest="${rest}"`);

    // Extract base type and length
    let baseType = dataType;
    let length: number | undefined;

    const lengthMatch = dataType.match(/(\w+)\((\d+)(?:,\s*\d+)?\)/);
    if (lengthMatch) {
      baseType = lengthMatch[1];
      length = parseInt(lengthMatch[2]);
    }

    // Determine properties from constraints
    const restUpper = rest.toUpperCase();
    const nullable = !restUpper.includes('NOT NULL');
    const primaryKey = restUpper.includes('PRIMARY KEY');
    const autoIncrement = restUpper.includes('AUTO_INCREMENT') || restUpper.includes('AUTOINCREMENT');
    const unique = restUpper.includes('UNIQUE');

    // Parse default value
    let defaultValue: any = undefined;
    const defaultMatch = rest.match(/DEFAULT\s+([^,\s]+)/i);
    if (defaultMatch) {
      let defaultVal = defaultMatch[1];
      if (defaultVal.toUpperCase() === 'NULL') {
        defaultValue = null;
      } else if (defaultVal.toUpperCase() === 'CURRENT_TIMESTAMP') {
        defaultValue = 'CURRENT_TIMESTAMP';
      } else {
        defaultVal = defaultVal.replace(/^['"]|['"]$/g, '');
        defaultValue = defaultVal;
      }
    }

    const column: BrowserColumn = {
      name,
      type: baseType as BrowserColumn['type'],
      length,
      nullable,
      primaryKey,
      autoIncrement,
      unique,
      defaultValue
    };

    console.log(`📋 Created column:`, column);
    return column;
  }

  private static executeInsertQuery(database: BrowserDatabase, query: string): ExecutionResult {
    try {
      console.log('🔧 Parsing INSERT:', query);

      // Clean the query
      query = query.replace(/\s+/g, ' ').trim();

      // Parse INSERT query
      const insertMatch = query.match(/INSERT\s+INTO\s+(\w+)\s*(?:\(([^)]+)\))?\s*VALUES\s*(.+)/i);
      if (!insertMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid INSERT syntax',
          queryType: 'INSERT'
        };
      }

      const tableName = insertMatch[1].trim();
      const columnsStr = insertMatch[2];
      const valuesStr = insertMatch[3];

      const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
      if (!table) {
        return {
          success: false,
          output: '',
          error: `Table "${tableName}" does not exist`,
          queryType: 'INSERT'
        };
      }

      // Parse column names
      let columnNames: string[];
      if (columnsStr) {
        columnNames = columnsStr.split(',').map(c => c.trim().replace(/[`"']/g, ''));
      } else {
        columnNames = table.columns.map(col => col.name);
      }

      console.log('📝 Column names:', columnNames);

      // Parse values - SIMPLIFIED VERSION
      const valueSets: string[][] = [];

      // Find all value tuples
      const valueRegex = /\(([^)]+)\)/g;
      let match;

      while ((match = valueRegex.exec(valuesStr)) !== null) {
        const tuple = match[1];
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < tuple.length; i++) {
          const char = tuple[i];

          if ((char === "'" || char === '"') && (i === 0 || tuple[i - 1] !== '\\')) {
            if (!inQuotes) {
              inQuotes = true;
              quoteChar = char;
            } else if (char === quoteChar) {
              inQuotes = false;
            }
            current += char;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }

        // Add last value
        if (current.trim()) {
          values.push(current.trim());
        }

        valueSets.push(values);
        console.log(`📦 Parsed values for row ${valueSets.length}:`, values);
      }

      if (valueSets.length === 0) {
        return {
          success: false,
          output: '',
          error: 'No values found to insert',
          queryType: 'INSERT'
        };
      }

      let insertedCount = 0;

      valueSets.forEach((valueSet, rowIndex) => {
        console.log(`📝 Processing row ${rowIndex + 1}:`, valueSet);

        const newRow: any = {};

        // Map values to columns
        columnNames.forEach((colName, colIndex) => {
          if (colIndex < valueSet.length) {
            const column = table.columns.find(c => c.name.toLowerCase() === colName.toLowerCase());
            if (column) {
              let value = valueSet[colIndex];

              // Handle NULL
              if (value.toUpperCase() === 'NULL') {
                newRow[column.name] = null;
              }
              // Handle DEFAULT
              else if (value.toUpperCase() === 'DEFAULT') {
                newRow[column.name] = column.defaultValue;
              }
              // Handle auto-increment
              else if (column.autoIncrement && column.primaryKey) {
                const maxId = table.data.reduce((max, row) => Math.max(max, row[column.name] || 0), 0);
                newRow[column.name] = maxId + 1;
              }
              else {
                // Clean string values
                value = value.trim();

                // Remove quotes if present
                if ((value.startsWith("'") && value.endsWith("'")) ||
                  (value.startsWith('"') && value.endsWith('"')) ||
                  (value.startsWith('`') && value.endsWith('`'))) {
                  value = value.substring(1, value.length - 1);
                }

                // Convert based on type
                if (column.type.includes('INT') || column.type === 'BIGINT') {
                  newRow[column.name] = parseInt(value) || 0;
                } else if (column.type.includes('DECIMAL') || column.type.includes('FLOAT')) {
                  newRow[column.name] = parseFloat(value) || 0;
                } else if (column.type === 'BOOLEAN') {
                  newRow[column.name] = value.toLowerCase() === 'true' || value === '1';
                } else {
                  newRow[column.name] = value;
                }
              }
            }
          }
        });

        // Fill missing columns (like auto-increment ID)
        table.columns.forEach(column => {
          if (newRow[column.name] === undefined) {
            if (column.autoIncrement && column.primaryKey) {
              const maxId = table.data.reduce((max, row) => Math.max(max, row[column.name] || 0), 0);
              newRow[column.name] = maxId + 1;
            } else if (column.defaultValue !== undefined) {
              newRow[column.name] = column.defaultValue;
            } else if (column.nullable) {
              newRow[column.name] = null;
            } else {
              // Default values
              if (column.type.includes('INT') || column.type.includes('DECIMAL')) {
                newRow[column.name] = 0;
              } else {
                newRow[column.name] = '';
              }
            }
          }
        });

        console.log(`✅ Row ${rowIndex + 1}:`, newRow);
        table.data.push(newRow);
        insertedCount++;
      });

      // Save the database
      this.saveDatabase(database);

      return {
        success: true,
        output: `${insertedCount} row${insertedCount !== 1 ? 's' : ''} inserted into ${tableName}`,
        affectedRows: insertedCount,
        queryType: 'INSERT'
      };

    } catch (error) {
      console.error('❌ INSERT error:', error);
      return {
        success: false,
        output: '',
        error: `INSERT error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queryType: 'INSERT'
      };
    }
  }

  // Also fix the parseInsertValues method:
  private static parseInsertValues(valuesStr: string): string[][] {
    const valueSets: string[][] = [];
    let currentSet: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    let quoteChar = '';
    let parenDepth = 0;

    // Clean the input string
    let str = valuesStr.trim();

    // Remove the word VALUES if present
    if (str.toUpperCase().startsWith('VALUES')) {
      str = str.substring(6).trim();
    }

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const nextChar = i < str.length - 1 ? str[i + 1] : '';

      // Handle parentheses
      if (char === '(') {
        if (parenDepth === 0) {
          // Start of a new value set
          currentSet = [];
          currentValue = '';
        } else {
          currentValue += char;
        }
        parenDepth++;
      }
      else if (char === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          // End of a value set
          if (currentValue.trim()) {
            currentSet.push(currentValue.trim());
          }
          if (currentSet.length > 0) {
            valueSets.push([...currentSet]);
          }
          currentValue = '';
          currentSet = [];
        } else {
          currentValue += char;
        }
      }
      // Handle quotes
      else if ((char === "'" || char === '"') && (i === 0 || str[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
        }
        currentValue += char;
      }
      // Handle commas (value separators)
      else if (char === ',' && !inQuotes) {
        if (parenDepth === 1) {
          // This comma separates values within the same set
          if (currentValue.trim()) {
            currentSet.push(currentValue.trim());
          }
          currentValue = '';
        } else if (parenDepth === 0) {
          // This comma separates value sets, ignore
          continue;
        } else {
          currentValue += char;
        }
      }
      // Handle everything else
      else {
        currentValue += char;
      }
    }

    // Handle any remaining value (shouldn't happen with valid SQL)
    if (currentValue.trim() && parenDepth === 0) {
      currentSet.push(currentValue.trim());
      if (currentSet.length > 0) {
        valueSets.push([...currentSet]);
      }
    }

    return valueSets;
  }

  private static executeUpdateQuery(database: BrowserDatabase, query: string): ExecutionResult {
    try {
      const updateMatch = query.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?/is);
      if (!updateMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid UPDATE syntax',
          queryType: 'UPDATE'
        };
      }

      const tableName = updateMatch[1];
      const setClause = updateMatch[2];
      const whereClause = updateMatch[3];

      const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
      if (!table) {
        return {
          success: false,
          output: '',
          error: `Table "${tableName}" does not exist`,
          queryType: 'UPDATE'
        };
      }

      // Parse SET clause
      const setPairs = setClause.split(',').map(pair => {
        const [col, val] = pair.split('=').map(p => p.trim());
        return {
          column: col.replace(/[`"']/g, ''),
          value: val
        };
      });

      let updatedCount = 0;

      table.data.forEach(row => {
        // Apply WHERE clause if exists
        let shouldUpdate = true;
        if (whereClause) {
          shouldUpdate = this.evaluateSimpleCondition(row, whereClause, table);
        }

        if (shouldUpdate) {
          setPairs.forEach(pair => {
            let value = pair.value;

            // Handle NULL
            if (value.toUpperCase() === 'NULL') {
              row[pair.column] = null;
            }
            // Handle DEFAULT
            else if (value.toUpperCase() === 'DEFAULT') {
              const column = table.columns.find(c => c.name === pair.column);
              row[pair.column] = column?.defaultValue;
            }
            // Remove quotes and convert
            else {
              value = value.replace(/^['"]|['"]$/g, '');
              const column = table.columns.find(c => c.name === pair.column);

              if (column?.type.includes('INT') || column?.type.includes('DECIMAL') || column?.type.includes('FLOAT') || column?.type.includes('DOUBLE')) {
                row[pair.column] = parseFloat(value);
              } else if (column?.type.includes('DATE') || column?.type.includes('TIME')) {
                row[pair.column] = new Date(value);
              } else if (column?.type === 'BOOLEAN') {
                row[pair.column] = value.toLowerCase() === 'true' || value === '1';
              } else {
                row[pair.column] = value;
              }
            }
          });
          updatedCount++;
        }
      });

      return {
        success: true,
        output: `${updatedCount} row${updatedCount !== 1 ? 's' : ''} updated`,
        affectedRows: updatedCount,
        queryType: 'UPDATE'
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: `UPDATE error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queryType: 'UPDATE'
      };
    }
  }

  private static executeDeleteQuery(database: BrowserDatabase, query: string): ExecutionResult {
    try {
      const deleteMatch = query.match(/DELETE FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/is);
      if (!deleteMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid DELETE syntax',
          queryType: 'DELETE'
        };
      }

      const tableName = deleteMatch[1];
      const whereClause = deleteMatch[2];

      const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
      if (!table) {
        return {
          success: false,
          output: '',
          error: `Table "${tableName}" does not exist`,
          queryType: 'DELETE'
        };
      }

      let deletedCount = 0;

      if (whereClause) {
        // Delete rows matching WHERE clause
        table.data = table.data.filter(row => {
          const shouldDelete = this.evaluateSimpleCondition(row, whereClause, table);
          if (shouldDelete) deletedCount++;
          return !shouldDelete;
        });
      } else {
        // Delete all rows
        deletedCount = table.data.length;
        table.data = [];
      }

      return {
        success: true,
        output: `${deletedCount} row${deletedCount !== 1 ? 's' : ''} deleted`,
        affectedRows: deletedCount,
        queryType: 'DELETE'
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: `DELETE error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queryType: 'DELETE'
      };
    }
  }

  private static executeDropTableQuery(database: BrowserDatabase, query: string): ExecutionResult {
    try {
      const dropMatch = query.match(/DROP TABLE\s+(\w+)/i);
      if (!dropMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid DROP TABLE syntax',
          queryType: 'DROP'
        };
      }

      const tableName = dropMatch[1];
      const tableIndex = database.tables.findIndex(t => t.name.toLowerCase() === tableName.toLowerCase());

      if (tableIndex === -1) {
        return {
          success: false,
          output: '',
          error: `Table "${tableName}" does not exist`,
          queryType: 'DROP'
        };
      }

      database.tables.splice(tableIndex, 1);

      return {
          success: true,
          output: `Table "${tableName}" dropped`,
          affectedRows: 0,
          queryType: 'DROP'
        };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: `DROP TABLE error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queryType: 'DROP'
      };
    }
  }

  private static executeTruncateTableQuery(database: BrowserDatabase, query: string): ExecutionResult {
    try {
      const truncateMatch = query.match(/TRUNCATE TABLE\s+(\w+)/i);
      if (!truncateMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid TRUNCATE syntax',
          queryType: 'TRUNCATE'
        };
      }

      const tableName = truncateMatch[1];
      const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());

      if (!table) {
        return {
          success: false,
          output: '',
          error: `Table "${tableName}" does not exist`,
          queryType: 'TRUNCATE'
        };
      }

      const rowCount = table.data.length;
      table.data = [];

      return {
        success: true,
        output: `Table "${tableName}" truncated`,
        affectedRows: rowCount,
        queryType: 'TRUNCATE'
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: `TRUNCATE error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queryType: 'TRUNCATE'
      };
    }
  }

  private static executeShowTablesQuery(database: BrowserDatabase): ExecutionResult {
    const tables = database.tables.map(table => ({
      Tables_in_database: table.name,
      Table_type: 'BASE TABLE',
      Engine: table.engine || 'InnoDB',
      Rows: table.data.length,
      Create_time: database.createdAt.toISOString().split('T')[0],
      Collation: table.charset ? `${table.charset}_general_ci` : 'utf8mb4_general_ci'
    }));

    return {
      success: true,
      output: `Tables in ${database.name}`,
      resultSet: tables,
      columns: ['Tables_in_database', 'Table_type', 'Engine', 'Rows', 'Create_time', 'Collation'],
      rowCount: tables.length,
      queryType: 'SHOW'
    };
  }

  private static executeDescribeQuery(database: BrowserDatabase, query: string): ExecutionResult {
    try {
      const describeMatch = query.match(/(?:DESCRIBE|DESC)\s+(\w+)/i);
      if (!describeMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid DESCRIBE syntax',
          queryType: 'DESCRIBE'
        };
      }

      const tableName = describeMatch[1];
      const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());

      if (!table) {
        return {
          success: false,
          output: '',
          error: `Table "${tableName}" does not exist`,
          queryType: 'DESCRIBE'
        };
      }

      const columnsInfo = table.columns.map(col => ({
        Field: col.name,
        Type: col.length ? `${col.type}(${col.length})` : col.type,
        Null: col.nullable ? 'YES' : 'NO',
        Key: col.primaryKey ? 'PRI' : col.unique ? 'UNI' : '',
        Default: col.defaultValue !== undefined ? String(col.defaultValue) : 'NULL',
        Extra: col.autoIncrement ? 'auto_increment' : ''
      }));

      return {
        success: true,
        output: `Structure of table "${tableName}"`,
        resultSet: columnsInfo,
        columns: ['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'],
        rowCount: columnsInfo.length,
        queryType: 'DESCRIBE'
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: `DESCRIBE error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queryType: 'DESCRIBE'
      };
    }
  }

  private static executeAlterTableQuery(database: BrowserDatabase, query: string): ExecutionResult {
    // Simplified ALTER TABLE implementation
    return {
      success: true,
      output: 'ALTER TABLE executed (simulated)',
      affectedRows: 0,
      queryType: 'ALTER'
    };
  }

  private static executeCreateDatabaseQuery(database: BrowserDatabase, query: string): ExecutionResult {
    try {
      const createMatch = query.match(/CREATE DATABASE\s+(\w+)/i);
      if (!createMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid CREATE DATABASE syntax',
          queryType: 'CREATE'
        };
      }

      const dbName = createMatch[1];
      this.createDatabase(dbName);

      return {
        success: true,
        output: `Database "${dbName}" created`,
        affectedRows: 0,
        queryType: 'CREATE'
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: `CREATE DATABASE error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queryType: 'CREATE'
      };
    }
  }

  private static executeDropDatabaseQuery(database: BrowserDatabase, query: string): ExecutionResult {
    try {
      const dropMatch = query.match(/DROP DATABASE\s+(\w+)/i);
      if (!dropMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid DROP DATABASE syntax',
          queryType: 'DROP'
        };
      }

      const dbName = dropMatch[1];
      this.deleteDatabase(dbName);

      return {
        success: true,
        output: `Database "${dbName}" dropped`,
        affectedRows: 0,
        queryType: 'DROP'
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: `DROP DATABASE error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queryType: 'DROP'
      };
    }
  }

  private static executeUseQuery(database: BrowserDatabase, query: string): ExecutionResult {
    try {
      const useMatch = query.match(/USE\s+(\w+)/i);
      if (!useMatch) {
        return {
          success: false,
          output: '',
          error: 'Invalid USE syntax',
          queryType: 'USE'
        };
      }

      const dbName = useMatch[1];
      const databases = this.getDatabases();
      const targetDb = databases.find(db => db.name.toLowerCase() === dbName.toLowerCase());

      if (!targetDb) {
        return {
          success: false,
          output: '',
          error: `Database "${dbName}" not found`,
          queryType: 'USE'
        };
      }

      this.setCurrentDatabase(dbName);

      return {
        success: true,
        output: `Database changed to "${dbName}"`,
        affectedRows: 0,
        queryType: 'USE'
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: `USE error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        queryType: 'USE'
      };
    }
  }

  private static executeShowDatabasesQuery(): ExecutionResult {
    const databases = this.getDatabases();
    const dbInfo = databases.map(db => ({
      Database: db.name,
      Size: '0 KB', // Simplified
      Created: db.createdAt.toISOString().split('T')[0]
    }));

    return {
      success: true,
      output: 'Databases',
      resultSet: dbInfo,
      columns: ['Database', 'Size', 'Created'],
      rowCount: dbInfo.length,
      queryType: 'SHOW'
    };
  }

  private static executeExplainQuery(database: BrowserDatabase, query: string): ExecutionResult {
    // Simplified EXPLAIN implementation
    const explainResult = [{
      id: 1,
      select_type: 'SIMPLE',
      table: 'table',
      partitions: null,
      type: 'ALL',
      possible_keys: null,
      key: null,
      key_len: null,
      ref: null,
      rows: 1,
      filtered: 100.00,
      Extra: 'Using where'
    }];

    return {
      success: true,
      output: 'EXPLAIN result',
      resultSet: explainResult,
      columns: ['id', 'select_type', 'table', 'partitions', 'type', 'possible_keys', 'key', 'key_len', 'ref', 'rows', 'filtered', 'Extra'],
      rowCount: 1,
      queryType: 'EXPLAIN'
    };
  }

  private static executeCreateIndexQuery(database: BrowserDatabase, query: string): ExecutionResult {
    // Simplified CREATE INDEX implementation
    return {
      success: true,
      output: 'Index created (simulated)',
      affectedRows: 0,
      queryType: 'CREATE'
    };
  }

  private static executeDropIndexQuery(database: BrowserDatabase, query: string): ExecutionResult {
    // Simplified DROP INDEX implementation
    return {
      success: true,
      output: 'Index dropped (simulated)',
      affectedRows: 0,
      queryType: 'DROP'
    };
  }

  private static executeBeginTransaction(database: BrowserDatabase): ExecutionResult {
    // Simplified transaction handling
    return {
      success: true,
      output: 'Transaction started',
      affectedRows: 0,
      queryType: 'BEGIN'
    };
  }

  private static executeCommitTransaction(database: BrowserDatabase): ExecutionResult {
    // Simplified transaction handling
    return {
      success: true,
      output: 'Transaction committed',
      affectedRows: 0,
      queryType: 'COMMIT'
    };
  }

  private static executeRollbackTransaction(database: BrowserDatabase): ExecutionResult {
    // Simplified transaction handling
    return {
      success: true,
      output: 'Transaction rolled back',
      affectedRows: 0,
      queryType: 'ROLLBACK'
    };
  }

  private static saveDatabase(database: BrowserDatabase): void {
    const databases = this.getDatabases();
    const dbIndex = databases.findIndex(db => db.name === database.name);

    if (dbIndex !== -1) {
      databases[dbIndex] = database;
    } else {
      databases.push(database);
    }

    this.saveDatabases(databases);
  }
}

export default BrowserDatabaseManager;