// SqlEditor.tsx - COMPLETE FIXED VERSION WITH QUESTION SIDEBAR LIKE FRONTENDQUESTION
"use client";

import { useState, useEffect, useCallback, useRef } from "react"
import {
    Play, RotateCcw, CheckCircle, X, Search, AlertTriangle,
    XCircle, ArrowLeft, Plus, RefreshCw, History, ChevronLeft,
    ChevronRight, HelpCircle, Database, Table, Loader2,
    ChevronDown, ChevronRight as ChevronRightIcon, Sidebar, SidebarClose,
    Maximize2, Minimize2, SplitSquareHorizontal, SplitSquareVertical,
    Download, Upload, Eye, EyeOff, Filter, FileText, Code,
    Copy, Save, Trash2, Edit, Settings, MoreVertical, Zap,
    Target, Award, Crown, Flame, Sparkles, Brain, Cpu,
    BarChart3, PieChart, LineChart, Clock, Calendar,
    User, Users, Shield, ShieldCheck, Key, Lock,
    Cloud, CloudUpload, CloudDownload, Wifi, Signal,
    Battery, BatteryCharging, Power, Volume2, Bell,
    MessageSquare, Mail, Phone, Video, Camera,
    Home, Building, MapPin, Navigation, Compass,
    Star, Heart, ThumbsUp, Award as AwardIcon,
    Trophy, Medal, Flag, Target as TargetIcon,
    PanelLeft, PanelRight, PanelLeftClose, PanelRightClose,
    Sun, Moon, Palette, Type, Layout, ZapOff,
    File, Folder, FolderOpen, FileCode, DatabaseIcon,
    BookOpen, Info, ChevronUp, Menu, Check,
    AlertCircle as AlertCircleIcon
} from "lucide-react"
import dynamic from 'next/dynamic'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Types (keep all your types exactly as they were)
interface BrowserDatabase {
    name: string
    description?: string
    tables: BrowserTable[]
    createdAt: Date
    lastModified: Date
    version: number
}

interface BrowserTable {
    name: string
    columns: BrowserColumn[]
    data: any[]
    indexes: string[]
    constraints: string[]
    engine: string
    charset: string
}

interface BrowserColumn {
    name: string
    type: string
    length?: number
    nullable: boolean
    primaryKey?: boolean
    autoIncrement?: boolean
    unique?: boolean
    defaultValue?: any
    foreignKey?: {
        table: string
        column: string
    }
}

interface ExecutionResult {
    success: boolean
    output: string
    error?: string
    resultSet?: any[]
    columns?: string[]
    rowCount?: number
    affectedRows?: number
    executionTime?: number
    queryType?: string
}

interface QueryHistoryItem {
    id: string
    query: string
    result: string
    timestamp: Date
    success: boolean
    executionTime: number
    rowCount?: number
    affectedRows?: number
}

interface QueryTab {
    id: string
    name: string
    query: string
    isDirty: boolean
    result?: ExecutionResult
}

interface ToastNotification {
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
    duration: number
}

interface QuestionType {
    _id: string
    id: string
    title: string
    description: string
    difficulty?: 'easy' | 'medium' | 'hard'
    points?: number
    expectedResult?: string
    hint?: string
    solution?: string
    example?: string
    constraints?: string[]
    exampleResult?: string
    hintCode?: string
}

interface SqlEditorProps {
    initialQuery?: string
    theme?: "light" | "dark" | "auto"
    showSubmitButton?: boolean
    submitLabel?: string
    showDatabaseControls?: boolean
    readOnly?: boolean
    onQueryChange?: (query: string) => void
    onQueryRun?: (result: any) => void
    onSubmit?: (query: string, result: any) => void
    registerSubmit?: (fn: () => void | Promise<void>) => void
    
    // Question-related props for sidebar
    question?: QuestionType
    currentQuestionIndex?: number
    totalQuestions?: number
    userAttempts?: number
    maxAttempts?: number
    attemptLimitEnabled?: boolean
    
    // New props for exercise functionality
    exercise?: any
    defaultQuestions?: any[]
    courseId?: string
    nodeId?: string
    nodeName?: string
    nodeType?: string
    subcategory?: string
    category?: string
    studentId?: string
    onBack?: () => void
    onCloseExercise?: () => void
    onResetExercise?: () => void
    initialQuestionIdx?: number
}

// Monaco Editor Configuration
const MonacoEditor = dynamic(
    () => import('@monaco-editor/react'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Loading Editor...</p>
                </div>
            </div>
        )
    }
)

// COMPLETE EnhancedDatabaseManager Class - IMPORTANT: This must be complete
class EnhancedDatabaseManager {
    private static STORAGE_KEY = 'enhanced_databases_sql_editor'
    private static QUERY_HISTORY_KEY = 'enhanced_query_history_sql_editor'
    private static currentDatabase: string = 'company_db'

    static getDatabases(): BrowserDatabase[] {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY)
            if (!stored) {
                const sampleDb = this.createSampleDatabase()
                return [sampleDb]
            }
            const parsed = JSON.parse(stored)
            return parsed.map((db: any) => ({
                ...db,
                createdAt: new Date(db.createdAt),
                lastModified: new Date(db.lastModified),
                tables: db.tables.map((table: any) => ({
                    ...table,
                    data: table.data || [],
                    columns: table.columns || []
                }))
            }))
        } catch (error) {
            console.error('Error loading databases:', error)
            return [this.createSampleDatabase()]
        }
    }

    static createSampleDatabase(): BrowserDatabase {
        const sampleDb: BrowserDatabase = {
            name: 'company_db',
            description: 'Sample company database with multiple tables',
            tables: [
                {
                    name: 'employees',
                    columns: [
                        { name: 'id', type: 'INT', primaryKey: true, autoIncrement: true, nullable: false },
                        { name: 'first_name', type: 'VARCHAR', length: 50, nullable: false },
                        { name: 'last_name', type: 'VARCHAR', length: 50, nullable: false },
                        { name: 'email', type: 'VARCHAR', length: 100, nullable: false, unique: true },
                        { name: 'department_id', type: 'INT', nullable: false },
                        { name: 'salary', type: 'DECIMAL', length: 10, nullable: true },
                        { name: 'hire_date', type: 'DATE', nullable: true }
                    ],
                    data: [
                        { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@company.com', department_id: 1, salary: 50000, hire_date: '2020-01-15' },
                        { id: 2, first_name: 'Jane', last_name: 'Smith', email: 'jane@company.com', department_id: 2, salary: 60000, hire_date: '2019-03-10' },
                        { id: 3, first_name: 'Bob', last_name: 'Johnson', email: 'bob@company.com', department_id: 1, salary: 55000, hire_date: '2021-06-20' }
                    ],
                    indexes: ['idx_department'],
                    constraints: ['fk_department'],
                    engine: 'InnoDB',
                    charset: 'utf8mb4'
                },
                {
                    name: 'departments',
                    columns: [
                        { name: 'id', type: 'INT', primaryKey: true, autoIncrement: true, nullable: false },
                        { name: 'name', type: 'VARCHAR', length: 100, nullable: false },
                        { name: 'location', type: 'VARCHAR', length: 100, nullable: true }
                    ],
                    data: [
                        { id: 1, name: 'Engineering', location: 'New York' },
                        { id: 2, name: 'Marketing', location: 'Chicago' },
                        { id: 3, name: 'Sales', location: 'Los Angeles' }
                    ],
                    indexes: [],
                    constraints: [],
                    engine: 'InnoDB',
                    charset: 'utf8mb4'
                }
            ],
            createdAt: new Date(),
            lastModified: new Date(),
            version: 1
        }
        this.saveDatabases([sampleDb])
        return sampleDb
    }

    static saveDatabases(databases: BrowserDatabase[]): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(databases))
        } catch (error) {
            console.error('Error saving databases:', error)
        }
    }

    static getQueryHistory(): QueryHistoryItem[] {
        try {
            const stored = localStorage.getItem(this.QUERY_HISTORY_KEY)
            if (!stored) return []
            const parsed = JSON.parse(stored)
            return parsed.map((item: any) => ({
                ...item,
                timestamp: new Date(item.timestamp)
            }))
        } catch (error) {
            return []
        }
    }

    static saveQueryHistory(history: QueryHistoryItem[]): void {
        try {
            localStorage.setItem(this.QUERY_HISTORY_KEY, JSON.stringify(history.slice(0, 1000)))
        } catch (error) {
            console.error('Error saving query history:', error)
        }
    }

    static getCurrentDatabase(): string {
        return this.currentDatabase
    }

    static setCurrentDatabase(databaseName: string): void {
        this.currentDatabase = databaseName
        localStorage.setItem('current_database', databaseName)
    }

    static initCurrentDatabase() {
        const saved = localStorage.getItem('current_database')
        if (saved) {
            this.currentDatabase = saved
        }
    }

    static async executeQuery(query: string): Promise<ExecutionResult> {
        const startTime = performance.now()

        try {
            const cleanQuery = query.trim()
            if (!cleanQuery) {
                return {
                    success: false,
                    output: '',
                    error: 'Empty query',
                    queryType: 'UNKNOWN',
                    executionTime: 0
                }
            }

            const statements = this.parseMultipleStatements(cleanQuery)
            if (statements.length === 0) {
                return {
                    success: false,
                    output: '',
                    error: 'No valid SQL statements found',
                    queryType: 'UNKNOWN',
                    executionTime: 0
                }
            }

            const results: ExecutionResult[] = []
            let lastSuccessfulResult: ExecutionResult | null = null

            for (const statement of statements) {
                const result = await this.executeSingleStatement(statement)
                results.push(result)

                if (result.success) {
                    lastSuccessfulResult = result
                }

                if (!result.success && !statement.toUpperCase().startsWith('SELECT')) {
                    break
                }
            }

            const executionTime = performance.now() - startTime

            if (results.length === 1) {
                return { ...results[0], executionTime }
            }

            const combinedResult = this.combineResults(results)
            return { ...combinedResult, executionTime }

        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime: performance.now() - startTime,
                queryType: 'ERROR'
            }
        }
    }

    private static parseMultipleStatements(query: string): string[] {
        const statements: string[] = []
        let currentStatement = ''
        let inString = false
        let stringChar = ''
        let inComment = false
        let commentType = ''

        for (let i = 0; i < query.length; i++) {
            const char = query[i]
            const nextChar = query[i + 1] || ''

            if (!inString && !inComment) {
                if (char === '-' && nextChar === '-') {
                    inComment = true
                    commentType = '--'
                    i++
                    continue
                } else if (char === '/' && nextChar === '*') {
                    inComment = true
                    commentType = '/*'
                    i++
                    continue
                }
            }

            if (!inComment && (char === "'" || char === '"')) {
                if (!inString) {
                    inString = true
                    stringChar = char
                } else if (stringChar === char) {
                    if (query[i - 1] === '\\') {
                        // escaped quote
                    } else {
                        inString = false
                    }
                }
            }

            if (inComment) {
                if (commentType === '--' && (char === '\n' || char === '\r')) {
                    inComment = false
                    commentType = ''
                } else if (commentType === '/*' && char === '*' && nextChar === '/') {
                    inComment = false
                    commentType = ''
                    i++
                }
                continue
            }

            if (!inString && char === ';') {
                const trimmed = currentStatement.trim()
                if (trimmed) {
                    statements.push(trimmed)
                }
                currentStatement = ''
                continue
            }

            currentStatement += char
        }

        const trimmed = currentStatement.trim()
        if (trimmed) {
            statements.push(trimmed)
        }

        return statements
    }

    private static async executeSingleStatement(statement: string): Promise<ExecutionResult> {
        const startTime = performance.now()
        const upperStatement = statement.toUpperCase()

        let databases = this.getDatabases()

        if (!this.currentDatabase) {
            this.initCurrentDatabase()
        }

        if (upperStatement.startsWith('USE ')) {
            return this.handleUseQuery(statement, databases)
        }

        if (upperStatement.startsWith('CREATE DATABASE')) {
            return this.handleCreateDatabase(statement, databases)
        }

        if (upperStatement.startsWith('SHOW DATABASES')) {
            return this.handleShowDatabases(databases)
        }

        let currentDb = databases.find(db => db.name === this.currentDatabase)

        if (!currentDb && databases.length > 0) {
            this.setCurrentDatabase(databases[0].name)
            currentDb = databases[0]
        }

        if (!currentDb) {
            currentDb = {
                name: 'default_db',
                tables: [],
                createdAt: new Date(),
                lastModified: new Date(),
                version: 1
            }
            databases.push(currentDb)
            this.setCurrentDatabase('default_db')
            this.saveDatabases(databases)
        }

        if (upperStatement.startsWith('SHOW TABLES')) {
            return this.handleShowTables(currentDb)
        }

        if (upperStatement.startsWith('DESCRIBE ') || upperStatement.startsWith('DESC ')) {
            return this.handleDescribe(statement, currentDb)
        }

        if (upperStatement.startsWith('CREATE TABLE')) {
            return this.handleCreateTable(statement, currentDb, databases)
        }

        if (upperStatement.startsWith('INSERT')) {
            return this.handleInsert(statement, currentDb, databases)
        }

        if (upperStatement.startsWith('SELECT')) {
            return this.handleSelect(statement, currentDb, databases)
        }

        if (upperStatement.startsWith('UPDATE')) {
            return this.handleUpdate(statement, currentDb, databases)
        }

        if (upperStatement.startsWith('DELETE')) {
            return this.handleDelete(statement, currentDb, databases)
        }

        if (upperStatement.startsWith('DROP TABLE')) {
            return this.handleDropTable(statement, currentDb, databases)
        }

        return {
            success: false,
            output: '',
            error: `Unsupported SQL statement: ${statement.substring(0, 50)}...`,
            queryType: 'UNKNOWN',
            executionTime: performance.now() - startTime
        }
    }

    private static combineResults(results: ExecutionResult[]): ExecutionResult {
        const successfulResults = results.filter(r => r.success)
        const failedResults = results.filter(r => !r.success)

        if (successfulResults.length === 0) {
            return results[results.length - 1]
        }

        const lastResult = successfulResults[successfulResults.length - 1]

        const combinedOutput = results
            .map((r, i) => {
                const num = i + 1
                if (r.success) {
                    return `Query ${num}: ${r.output}`
                } else {
                    return `Query ${num}: ERROR - ${r.error}`
                }
            })
            .join('\n')

        return {
            success: failedResults.length === 0,
            output: combinedOutput,
            resultSet: lastResult.resultSet,
            columns: lastResult.columns,
            rowCount: lastResult.rowCount,
            affectedRows: results.reduce((sum, r) => sum + (r.affectedRows || 0), 0),
            queryType: 'MULTIPLE',
            executionTime: results.reduce((sum, r) => sum + (r.executionTime || 0), 0)
        }
    }

    private static handleUseQuery(query: string, databases: BrowserDatabase[]): ExecutionResult {
        try {
            const dbNameMatch = query.match(/USE\s+([^\s;]+)/i)
            if (!dbNameMatch) {
                return { success: false, output: '', error: 'Invalid USE syntax', queryType: 'USE' }
            }

            const dbName = dbNameMatch[1].replace(/[`'"]/g, '')

            let database = databases.find(db => db.name.toLowerCase() === dbName.toLowerCase())

            if (!database) {
                return {
                    success: false,
                    output: '',
                    error: `Database "${dbName}" does not exist`,
                    queryType: 'USE',
                    executionTime: 0
                }
            }

            this.setCurrentDatabase(dbName)

            return {
                success: true,
                output: `Database changed to "${dbName}"`,
                affectedRows: 0,
                queryType: 'USE',
                executionTime: 0
            }

        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'USE query failed',
                queryType: 'USE',
                executionTime: 0
            }
        }
    }

    private static handleCreateDatabase(query: string, databases: BrowserDatabase[]): ExecutionResult {
        try {
            const dbNameMatch = query.match(/CREATE DATABASE\s+([^\s;]+)/i)
            if (!dbNameMatch) {
                return { success: false, output: '', error: 'Invalid CREATE DATABASE syntax', queryType: 'CREATE' }
            }

            const dbName = dbNameMatch[1].replace(/[`'"]/g, '')

            if (databases.some(db => db.name.toLowerCase() === dbName.toLowerCase())) {
                return { success: false, output: '', error: `Database "${dbName}" already exists`, queryType: 'CREATE' }
            }

            const newDatabase: BrowserDatabase = {
                name: dbName,
                tables: [],
                createdAt: new Date(),
                lastModified: new Date(),
                version: 1
            }

            databases.push(newDatabase)
            this.saveDatabases(databases)

            return {
                success: true,
                output: `Database "${dbName}" created successfully`,
                affectedRows: 0,
                queryType: 'CREATE',
                executionTime: 0
            }

        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'CREATE DATABASE failed',
                queryType: 'CREATE',
                executionTime: 0
            }
        }
    }

    private static handleShowDatabases(databases: BrowserDatabase[]): ExecutionResult {
        const result = databases.map(db => ({
            Database: db.name,
            Tables: db.tables.length,
            Created: db.createdAt.toISOString().split('T')[0]
        }))

        return {
            success: true,
            output: `${databases.length} database(s)`,
            resultSet: result,
            columns: ['Database', 'Tables', 'Created'],
            rowCount: result.length,
            queryType: 'SHOW',
            executionTime: 0
        }
    }

    private static handleShowTables(database: BrowserDatabase): ExecutionResult {
        const result = database.tables.map(table => ({
            Tables_in_database: table.name,
            Table_type: 'BASE TABLE',
            Rows: table.data.length
        }))

        return {
            success: true,
            output: `Tables in ${database.name}`,
            resultSet: result,
            columns: ['Tables_in_database', 'Table_type', 'Rows'],
            rowCount: result.length,
            queryType: 'SHOW',
            executionTime: 0
        }
    }

    private static handleDescribe(query: string, database: BrowserDatabase): ExecutionResult {
        try {
            const tableMatch = query.match(/(?:DESCRIBE|DESC)\s+([^\s]+)/i)
            if (!tableMatch) {
                return { success: false, output: '', error: 'Invalid DESCRIBE syntax', queryType: 'DESCRIBE' }
            }

            const tableName = tableMatch[1].replace(/[`'"]/g, '')
            const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase())

            if (!table) {
                return { success: false, output: '', error: `Table "${tableName}" not found`, queryType: 'DESCRIBE' }
            }

            const result = table.columns.map(col => ({
                Field: col.name,
                Type: col.length ? `${col.type}(${col.length})` : col.type,
                Null: col.nullable ? 'YES' : 'NO',
                Key: col.primaryKey ? 'PRI' : col.unique ? 'UNI' : '',
                Default: col.defaultValue !== undefined ? String(col.defaultValue) : 'NULL',
                Extra: col.autoIncrement ? 'auto_increment' : ''
            }))

            return {
                success: true,
                output: `Structure of table "${tableName}"`,
                resultSet: result,
                columns: ['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'],
                rowCount: result.length,
                queryType: 'DESCRIBE',
                executionTime: 0
            }

        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'DESCRIBE failed',
                queryType: 'DESCRIBE',
                executionTime: 0
            }
        }
    }

    private static handleCreateTable(query: string, database: BrowserDatabase, databases: BrowserDatabase[]): ExecutionResult {
        try {
            const tableMatch = query.match(/CREATE TABLE\s+([^\s(]+)/i)
            if (!tableMatch) {
                return { success: false, output: '', error: 'Invalid CREATE TABLE syntax', queryType: 'CREATE' }
            }

            const tableName = tableMatch[1].replace(/[`'"]/g, '')

            if (database.tables.some(t => t.name.toLowerCase() === tableName.toLowerCase())) {
                return { success: false, output: '', error: `Table "${tableName}" already exists`, queryType: 'CREATE' }
            }

            const columnsMatch = query.match(/\(([\s\S]+)\)/)
            if (!columnsMatch) {
                return { success: false, output: '', error: 'No columns defined', queryType: 'CREATE' }
            }

            const columnsText = columnsMatch[1]
            const columnLines = columnsText.split(',').map(line => line.trim()).filter(line => line)

            const columns: BrowserColumn[] = []
            const constraints: string[] = []

            for (const line of columnLines) {
                const upperLine = line.toUpperCase()

                if (upperLine.includes('PRIMARY KEY') || upperLine.includes('FOREIGN KEY') || upperLine.includes('UNIQUE KEY')) {
                    constraints.push(line)
                    continue
                }

                const parts = line.split(/\s+/)
                if (parts.length < 2) continue

                const name = parts[0].replace(/[`'"]/g, '')
                let type = parts[1].toUpperCase()

                let length: number | undefined = undefined
                const lengthMatch = type.match(/\((\d+(?:,\s*\d+)?)\)/)
                if (lengthMatch) {
                    length = parseInt(lengthMatch[1].split(',')[0].trim())
                    type = type.split('(')[0]
                }

                const autoIncrement = upperLine.includes('AUTO_INCREMENT') || upperLine.includes('AUTOINCREMENT')
                const primaryKey = upperLine.includes('PRIMARY KEY')
                const nullable = !upperLine.includes('NOT NULL')
                const unique = upperLine.includes('UNIQUE')

                let defaultValue: any = undefined
                const defaultMatch = line.match(/DEFAULT\s+([^\s,]+)/i)
                if (defaultMatch) {
                    let defaultVal = defaultMatch[1].replace(/['"]/g, '')
                    if (defaultVal.toUpperCase() === 'CURRENT_TIMESTAMP') {
                        defaultValue = new Date().toISOString().split('T')[0]
                    } else if (defaultVal.toUpperCase() === 'NULL') {
                        defaultValue = null
                    } else if (!isNaN(Number(defaultVal)) && defaultVal.trim() !== '') {
                        defaultValue = Number(defaultVal)
                    } else {
                        defaultValue = defaultVal
                    }
                }

                columns.push({
                    name,
                    type,
                    length,
                    nullable,
                    primaryKey,
                    autoIncrement,
                    unique,
                    defaultValue
                })
            }

            const newTable: BrowserTable = {
                name: tableName,
                columns,
                data: [],
                indexes: [],
                constraints,
                engine: 'InnoDB',
                charset: 'utf8mb4'
            }

            database.tables.push(newTable)
            database.lastModified = new Date()
            this.saveDatabases(databases)

            return {
                success: true,
                output: `Table "${tableName}" created successfully`,
                affectedRows: 0,
                queryType: 'CREATE',
                executionTime: 0
            }

        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'CREATE TABLE failed',
                queryType: 'CREATE',
                executionTime: 0
            }
        }
    }

    private static handleInsert(query: string, database: BrowserDatabase, databases: BrowserDatabase[]): ExecutionResult {
        try {
            const cleanQuery = query.replace(/\s+/g, ' ').trim()

            const insertPattern = /INSERT\s+INTO\s+([^\s(]+)(?:\s*\(([^)]+)\))?\s+VALUES\s*(.+)/i
            const match = cleanQuery.match(insertPattern)

            if (!match) {
                return {
                    success: false,
                    output: '',
                    error: 'Invalid INSERT syntax',
                    queryType: 'INSERT'
                }
            }

            const tableName = match[1].replace(/[`'"]/g, '')
            const columnsPart = match[2] || ''
            const valuesPart = match[3].trim()

            const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase())

            if (!table) {
                return { success: false, output: '', error: `Table "${tableName}" not found`, queryType: 'INSERT' }
            }

            let specifiedColumns: string[] = []
            if (columnsPart) {
                specifiedColumns = columnsPart.split(',').map(col => col.trim().replace(/[`'"]/g, ''))
            } else {
                specifiedColumns = table.columns
                    .filter(col => !col.autoIncrement)
                    .map(col => col.name)
            }

            const rows = this.parseValuesWithStateMachine(valuesPart)

            if (rows.length === 0) {
                return { success: false, output: '', error: 'No valid rows to insert', queryType: 'INSERT' }
            }

            let insertedCount = 0
            const errors: string[] = []

            for (const rowValues of rows) {
                if (rowValues.length !== specifiedColumns.length) {
                    errors.push(`Row ${insertedCount + 1}: Expected ${specifiedColumns.length} values, got ${rowValues.length}`)
                    continue
                }

                try {
                    const newRow: any = {}

                    specifiedColumns.forEach((colName, index) => {
                        let value = rowValues[index]

                        if (value.toUpperCase() === 'NULL') {
                            newRow[colName] = null
                            return
                        }

                        if ((value.startsWith("'") && value.endsWith("'")) ||
                            (value.startsWith('"') && value.endsWith('"'))) {
                            value = value.substring(1, value.length - 1)
                            value = value.replace(/''/g, "'")
                        }

                        const column = table.columns.find(c => c.name === colName)
                        if (column) {
                            if (column.type === 'INT' || column.type === 'INTEGER' || column.type === 'BIGINT') {
                                value = parseInt(value) || 0
                            } else if (column.type === 'DECIMAL' || column.type === 'FLOAT' || column.type === 'DOUBLE' || column.type === 'NUMERIC') {
                                value = parseFloat(value) || 0
                            } else if (column.type === 'BOOLEAN' || column.type === 'BOOL') {
                                value = value.toLowerCase() === 'true' || value === '1' || value === 't'
                            }
                        }

                        newRow[colName] = value
                    })

                    table.columns.forEach(col => {
                        if (col.autoIncrement && !newRow[col.name]) {
                            const maxId = Math.max(0, ...table.data.map(r => r[col.name] || 0))
                            newRow[col.name] = maxId + 1
                        }
                    })

                    table.columns.forEach(col => {
                        if (!newRow.hasOwnProperty(col.name)) {
                            if (col.defaultValue !== undefined) {
                                newRow[col.name] = col.defaultValue
                            } else if (col.nullable) {
                                newRow[col.name] = null
                            }
                        }
                    })

                    table.data.push(newRow)
                    insertedCount++

                } catch (error) {
                    errors.push(`Row ${insertedCount + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`)
                }
            }

            if (insertedCount === 0 && errors.length > 0) {
                return {
                    success: false,
                    output: '',
                    error: errors.join('\n'),
                    queryType: 'INSERT',
                    executionTime: 0
                }
            }

            database.lastModified = new Date()
            this.saveDatabases(databases)

            this.addToQueryHistory({
                id: Date.now().toString(),
                query,
                result: `Inserted ${insertedCount} row(s)`,
                timestamp: new Date(),
                success: true,
                executionTime: 0,
                affectedRows: insertedCount
            })

            let output = `${insertedCount} row(s) inserted into "${tableName}"`
            if (errors.length > 0) {
                output += ` (${errors.length} row(s) failed: ${errors.join('; ')})`
            }

            return {
                success: true,
                output,
                affectedRows: insertedCount,
                queryType: 'INSERT',
                executionTime: 0
            }

        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'INSERT failed',
                queryType: 'INSERT',
                executionTime: 0
            }
        }
    }

    private static parseValuesWithStateMachine(valuesText: string): string[][] {
        const rows: string[][] = []
        let currentRow: string[] = []
        let currentValue = ''
        let inString = false
        let stringChar = ''
        let inRow = false

        for (let i = 0; i < valuesText.length; i++) {
            const char = valuesText[i]

            if (!inRow && char === '(') {
                inRow = true
                continue
            }

            if (!inRow && char.trim() === '') {
                continue
            }

            if (inRow) {
                if (!inString && char === ')') {
                    if (currentValue.trim()) {
                        currentRow.push(currentValue.trim())
                    }
                    if (currentRow.length > 0) {
                        rows.push([...currentRow])
                    }
                    currentRow = []
                    currentValue = ''
                    inRow = false
                    inString = false
                    continue
                }

                if (!inString && char === ',') {
                    currentRow.push(currentValue.trim())
                    currentValue = ''
                    continue
                }

                if (char === "'" || char === '"') {
                    if (!inString) {
                        inString = true
                        stringChar = char
                    } else if (stringChar === char) {
                        if (i + 1 < valuesText.length && valuesText[i + 1] === stringChar) {
                            currentValue += char
                            i++
                            continue
                        }
                        inString = false
                    }
                }

                currentValue += char
            }
        }

        if (currentRow.length > 0 || currentValue.trim()) {
            if (currentValue.trim()) {
                currentRow.push(currentValue.trim())
            }
            if (currentRow.length > 0) {
                rows.push([...currentRow])
            }
        }

        return rows
    }

    private static handleSelect(query: string, database: BrowserDatabase, databases: BrowserDatabase[]): ExecutionResult {
        try {
            const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i)
            if (!selectMatch) {
                return { success: false, output: '', error: 'Invalid SELECT query', queryType: 'SELECT' }
            }

            const fromMatch = query.match(/FROM\s+([^\s;,]+)(?:\s+(?:AS\s+)?([^\s,;]+))?(?:\s*(?:,|\b(?:INNER|LEFT|RIGHT|FULL)\s+JOIN)\s+[^\s;,]+)*/i)
            if (!fromMatch) {
                return { success: false, output: '', error: 'Missing FROM clause', queryType: 'SELECT' }
            }

            const mainTableName = fromMatch[1].replace(/[`'"]/g, '')
            const mainTable = database.tables.find(t => t.name.toLowerCase() === mainTableName.toLowerCase())

            if (!mainTable) {
                return { success: false, output: '', error: `Table "${mainTableName}" not found`, queryType: 'SELECT' }
            }

            const columnsText = selectMatch[1]
            let selectedColumns: string[] = []

            if (columnsText === '*') {
                selectedColumns = mainTable.columns.map(col => col.name)
            } else {
                selectedColumns = columnsText.split(',').map(col => {
                    const trimmed = col.trim()
                    const dotIndex = trimmed.lastIndexOf('.')
                    return dotIndex !== -1 ? trimmed.substring(dotIndex + 1).replace(/[`'"]/g, '') : trimmed.replace(/[`'"]/g, '')
                })
            }

            let data = [...mainTable.data]

            const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+(?:ORDER BY|GROUP BY|HAVING|LIMIT|$))/i)
            if (whereMatch) {
                const condition = whereMatch[1]
                data = data.filter(row => this.evaluateCondition(row, condition, database))
            }

            const groupByMatch = query.match(/GROUP BY\s+(.+?)(?:\s+(?:HAVING|ORDER BY|LIMIT|$))/i)
            if (groupByMatch) {
                const groupColumns = groupByMatch[1].split(',').map(col => col.trim().replace(/[`'"]/g, ''))
                data = this.applyGroupBy(data, groupColumns, selectedColumns)
            }

            const havingMatch = query.match(/HAVING\s+(.+?)(?:\s+(?:ORDER BY|LIMIT|$))/i)
            if (havingMatch && groupByMatch) {
                const condition = havingMatch[1]
                data = data.filter(row => this.evaluateCondition(row, condition, database))
            }

            const orderMatch = query.match(/ORDER BY\s+(.+?)(?:\s+(?:ASC|DESC))?(?:\s+(?:LIMIT|$))/i)
            if (orderMatch) {
                const orderParts = orderMatch[1].split(',').map(part => {
                    const [col, dir] = part.trim().split(/\s+/)
                    return {
                        column: col.replace(/[`'"]/g, ''),
                        direction: (dir || 'ASC').toUpperCase()
                    }
                })

                data.sort((a, b) => {
                    for (const order of orderParts) {
                        const aVal = a[order.column]
                        const bVal = b[order.column]

                        if (aVal === bVal) continue

                        if (order.direction === 'ASC') {
                            return aVal > bVal ? 1 : -1
                        } else {
                            return aVal < bVal ? 1 : -1
                        }
                    }
                    return 0
                })
            }

            const limitMatch = query.match(/LIMIT\s+(\d+)(?:\s*,\s*(\d+))?/i)
            if (limitMatch) {
                const limit = limitMatch[2] ? parseInt(limitMatch[2]) : parseInt(limitMatch[1])
                const offset = limitMatch[2] ? parseInt(limitMatch[1]) : 0
                data = data.slice(offset, offset + limit)
            }

            const resultSet = data.map(row => {
                const filteredRow: any = {}
                selectedColumns.forEach(col => {
                    if (row[col] !== undefined) {
                        filteredRow[col] = row[col]
                    }
                })
                return filteredRow
            })

            this.addToQueryHistory({
                id: Date.now().toString(),
                query,
                result: `${data.length} row(s) returned`,
                timestamp: new Date(),
                success: true,
                executionTime: 0,
                rowCount: data.length
            })

            return {
                success: true,
                output: `${data.length} row(s) returned from "${mainTableName}"`,
                resultSet,
                columns: selectedColumns,
                rowCount: data.length,
                queryType: 'SELECT',
                executionTime: 0
            }

        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'SELECT query failed',
                queryType: 'SELECT',
                executionTime: 0
            }
        }
    }

    private static evaluateCondition(row: any, condition: string, database: BrowserDatabase): boolean {
        try {
            const normalized = condition.trim().toUpperCase()

            if (normalized.includes(' AND ')) {
                const parts = condition.split(' AND ').map(p => p.trim())
                return parts.every(part => this.evaluateCondition(row, part, database))
            }

            if (normalized.includes(' OR ')) {
                const parts = condition.split(' OR ').map(p => p.trim())
                return parts.some(part => this.evaluateCondition(row, part, database))
            }

            const operators = ['!=', '>=', '<=', '=', '>', '<']
            for (const op of operators) {
                if (condition.includes(op)) {
                    const [left, right] = condition.split(op).map(s => s.trim())
                    const column = left.replace(/[`'"]/g, '')
                    const value = right.replace(/['"]/g, '')

                    const rowValue = row[column]

                    let compareValue: any = value
                    if (typeof rowValue === 'number') {
                        compareValue = isNaN(Number(value)) ? value : Number(value)
                    } else if (rowValue instanceof Date) {
                        compareValue = new Date(value)
                    } else if (typeof rowValue === 'boolean') {
                        compareValue = value.toLowerCase() === 'true' || value === '1'
                    }

                    switch (op) {
                        case '=': return rowValue == compareValue
                        case '!=': return rowValue != compareValue
                        case '>': return rowValue > compareValue
                        case '<': return rowValue < compareValue
                        case '>=': return rowValue >= compareValue
                        case '<=': return rowValue <= compareValue
                    }
                }
            }

            return true

        } catch {
            return true
        }
    }

    private static applyGroupBy(data: any[], groupColumns: string[], selectColumns: string[]): any[] {
        const groups = new Map<string, any>()

        for (const row of data) {
            const key = groupColumns.map(col => row[col]).join('|')

            if (!groups.has(key)) {
                const groupRow: any = {}
                groupColumns.forEach(col => {
                    groupRow[col] = row[col]
                })
                selectColumns.forEach(col => {
                    if (!groupColumns.includes(col) && !col.includes('(')) {
                        groupRow[col] = [row[col]]
                    }
                })
                groups.set(key, groupRow)
            } else {
                const groupRow = groups.get(key)
                selectColumns.forEach(col => {
                    if (!groupColumns.includes(col) && !col.includes('(')) {
                        if (!Array.isArray(groupRow[col])) {
                            groupRow[col] = [groupRow[col]]
                        }
                        groupRow[col].push(row[col])
                    }
                })
            }
        }

        const result: any[] = []
        for (const groupRow of groups.values()) {
            const finalRow = { ...groupRow }
            selectColumns.forEach(col => {
                if (!groupColumns.includes(col)) {
                    if (Array.isArray(finalRow[col])) {
                        if (col.toUpperCase().includes('SUM(')) {
                            const colName = col.replace(/SUM\(|\)/gi, '')
                            finalRow[col] = groupRow[colName]?.reduce((a: number, b: number) => a + b, 0) || 0
                        } else if (col.toUpperCase().includes('COUNT(')) {
                            finalRow[col] = groupRow[col]?.length || 0
                        } else if (col.toUpperCase().includes('AVG(')) {
                            const colName = col.replace(/AVG\(|\)/gi, '')
                            const values = groupRow[colName]
                            finalRow[col] = values?.reduce((a: number, b: number) => a + b, 0) / values?.length || 0
                        } else if (col.toUpperCase().includes('MAX(')) {
                            const colName = col.replace(/MAX\(|\)/gi, '')
                            finalRow[col] = Math.max(...(groupRow[colName] || []))
                        } else if (col.toUpperCase().includes('MIN(')) {
                            const colName = col.replace(/MIN\(|\)/gi, '')
                            finalRow[col] = Math.min(...(groupRow[colName] || []))
                        }
                    }
                }
            })
            result.push(finalRow)
        }

        return result
    }

    private static handleUpdate(query: string, database: BrowserDatabase, databases: BrowserDatabase[]): ExecutionResult {
        try {
            const tableMatch = query.match(/UPDATE\s+([^\s]+)/i)
            if (!tableMatch) {
                return { success: false, output: '', error: 'Invalid UPDATE syntax', queryType: 'UPDATE' }
            }

            const tableName = tableMatch[1].replace(/[`'"]/g, '')
            const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase())

            if (!table) {
                return { success: false, output: '', error: `Table "${tableName}" not found`, queryType: 'UPDATE' }
            }

            const setMatch = query.match(/SET\s+(.+?)(?:\s+WHERE|$)/i)
            if (!setMatch) {
                return { success: false, output: '', error: 'No SET clause found', queryType: 'UPDATE' }
            }

            const setClause = setMatch[1]
            const updates: Record<string, any> = {}

            const assignments = setClause.split(',').map(a => a.trim())
            assignments.forEach(assign => {
                const [col, val] = assign.split('=').map(s => s.trim())
                if (col && val) {
                    const colName = col.replace(/[`'"]/g, '')
                    let value = val.replace(/['"]/g, '')

                    const column = table.columns.find(c => c.name === colName)
                    if (column) {
                        if (column.type === 'INT' || column.type === 'INTEGER' || column.type === 'BIGINT') {
                            value = parseInt(value) || 0
                        } else if (column.type === 'DECIMAL' || column.type === 'FLOAT' || column.type === 'DOUBLE' || column.type === 'NUMERIC') {
                            value = parseFloat(value) || 0
                        } else if (column.type === 'BOOLEAN' || column.type === 'BOOL') {
                            value = value === 'true' || value === '1'
                        }
                    }

                    updates[colName] = value
                }
            })

            let updatedCount = 0
            const whereMatch = query.match(/WHERE\s+(.+)/i)

            table.data.forEach(row => {
                let shouldUpdate = true

                if (whereMatch) {
                    shouldUpdate = this.evaluateCondition(row, whereMatch[1], database)
                }

                if (shouldUpdate) {
                    Object.keys(updates).forEach(col => {
                        row[col] = updates[col]
                    })
                    updatedCount++
                }
            })

            if (updatedCount > 0) {
                database.lastModified = new Date()
                this.saveDatabases(databases)

                this.addToQueryHistory({
                    id: Date.now().toString(),
                    query,
                    result: `Updated ${updatedCount} row(s)`,
                    timestamp: new Date(),
                    success: true,
                    executionTime: 0,
                    affectedRows: updatedCount
                })
            }

            return {
                success: true,
                output: `${updatedCount} row(s) updated in "${tableName}"`,
                affectedRows: updatedCount,
                queryType: 'UPDATE',
                executionTime: 0
            }

        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'UPDATE failed',
                queryType: 'UPDATE',
                executionTime: 0
            }
        }
    }

    private static handleDelete(query: string, database: BrowserDatabase, databases: BrowserDatabase[]): ExecutionResult {
        try {
            const tableMatch = query.match(/DELETE\s+FROM\s+([^\s]+)/i)
            if (!tableMatch) {
                return { success: false, output: '', error: 'Invalid DELETE syntax', queryType: 'DELETE' }
            }

            const tableName = tableMatch[1].replace(/[`'"]/g, '')
            const table = database.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase())

            if (!table) {
                return { success: false, output: '', error: `Table "${tableName}" not found`, queryType: 'DELETE' }
            }

            let deletedCount = 0
            const whereMatch = query.match(/WHERE\s+(.+)/i)

            if (whereMatch) {
                const originalLength = table.data.length
                table.data = table.data.filter(row => {
                    const shouldDelete = this.evaluateCondition(row, whereMatch[1], database)
                    if (shouldDelete) deletedCount++
                    return !shouldDelete
                })
            } else {
                deletedCount = table.data.length
                table.data = []
            }

            if (deletedCount > 0) {
                database.lastModified = new Date()
                this.saveDatabases(databases)

                this.addToQueryHistory({
                    id: Date.now().toString(),
                    query,
                    result: `Deleted ${deletedCount} row(s)`,
                    timestamp: new Date(),
                    success: true,
                    executionTime: 0,
                    affectedRows: deletedCount
                })
            }

            return {
                success: true,
                output: `${deletedCount} row(s) deleted from "${tableName}"`,
                affectedRows: deletedCount,
                queryType: 'DELETE',
                executionTime: 0
            }

        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'DELETE failed',
                queryType: 'DELETE',
                executionTime: 0
            }
        }
    }

    private static handleDropTable(query: string, database: BrowserDatabase, databases: BrowserDatabase[]): ExecutionResult {
        try {
            const tableMatch = query.match(/DROP TABLE\s+([^\s]+)/i)
            if (!tableMatch) {
                return { success: false, output: '', error: 'Invalid DROP TABLE syntax', queryType: 'DROP' }
            }

            const tableName = tableMatch[1].replace(/[`'"]/g, '')
            const tableIndex = database.tables.findIndex(t => t.name.toLowerCase() === tableName.toLowerCase())

            if (tableIndex === -1) {
                return { success: false, output: '', error: `Table "${tableName}" not found`, queryType: 'DROP' }
            }

            database.tables.splice(tableIndex, 1)
            database.lastModified = new Date()
            this.saveDatabases(databases)

            return {
                success: true,
                output: `Table "${tableName}" dropped`,
                affectedRows: 0,
                queryType: 'DROP',
                executionTime: 0
            }

        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'DROP TABLE failed',
                queryType: 'DROP',
                executionTime: 0
            }
        }
    }

    private static addToQueryHistory(item: Omit<QueryHistoryItem, 'executionTime'> & { executionTime: number }): void {
        const history = this.getQueryHistory()
        history.unshift({
            ...item,
            executionTime: item.executionTime || 0
        })
        this.saveQueryHistory(history.slice(0, 1000))
    }
}

// Theme Toggle Component
const ThemeToggle = ({
    theme,
    setTheme
}: {
    theme: string,
    setTheme: (theme: string) => void
}) => {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const toggleTheme = () => {
        if (theme === 'light') {
            setTheme('dark')
            document.documentElement.classList.add('dark')
        } else if (theme === 'dark') {
            setTheme('light')
            document.documentElement.classList.remove('dark')
        } else {
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            if (systemPrefersDark) {
                setTheme('light')
                document.documentElement.classList.remove('dark')
            } else {
                setTheme('dark')
                document.documentElement.classList.add('dark')
            }
        }
    }

    if (!mounted) return null

    return (
        <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-full hover:scale-110 transition-all duration-200 ${theme === 'dark'
                ? 'bg-gray-800 hover:bg-gray-700 text-yellow-300'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
            {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
            ) : (
                <Moon className="w-4 h-4" />
            )}
        </button>
    )
}

// Question Sidebar Component - Exactly like FrontendQuestion
const QuestionSidebar = ({
    question,
    currentQuestionIndex,
    totalQuestions,
    userAttempts,
    maxAttempts,
    attemptLimitEnabled,
    onToggleCollapse,
    isCollapsed,
    theme = "light"
}: {
    question: QuestionType
    currentQuestionIndex: number
    totalQuestions: number
    userAttempts: number
    maxAttempts: number
    attemptLimitEnabled: boolean
    onToggleCollapse: () => void
    isCollapsed: boolean
    theme?: "light" | "dark"
}) => {
    const [showHint, setShowHint] = useState(false)
    const [showSolution, setShowSolution] = useState(false)
    const [showExample, setShowExample] = useState(false)

    const colors = theme === 'light' ? {
        background: '#f8f9fa',
        border: '#dee2e6',
        text: '#212529',
        textSecondary: '#6c757d',
        primary: '#007acc',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        info: '#17a2b8'
    } : {
        background: '#252526',
        border: '#3e3e42',
        text: '#e9ecef',
        textSecondary: '#adb5bd',
        primary: '#007acc',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        info: '#17a2b8'
    };

    if (isCollapsed) {
        return (
            <div className={`h-full flex flex-col items-center justify-center border-r transition-all duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'}`}>
                <button
                    onClick={onToggleCollapse}
                    className={`p-3 rounded hover:scale-110 transition-all ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}
                    title="Expand Question Panel"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
                <div className="mt-4 transform -rotate-90 whitespace-nowrap text-xs font-medium">
                    Q{currentQuestionIndex + 1}/{totalQuestions}
                </div>
            </div>
        )
    }

    return (
        <div className={`h-full flex flex-col transition-all duration-300 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'} border-r ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>
            {/* Header */}
            <div className={`p-3 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleCollapse}
                        className={`p-1.5 rounded hover:scale-110 transition-all ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}
                        title="Collapse Question Panel"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2">
                        <BookOpen size={16} style={{ color: colors.primary }} />
                        <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Question {currentQuestionIndex + 1}
                        </h3>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {question.difficulty && (
                        <span className={`px-2 py-1 text-xs rounded ${question.difficulty === 'easy'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : question.difficulty === 'medium'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                            {question.difficulty}
                        </span>
                    )}
                    {attemptLimitEnabled && (
                        <span className={`text-xs px-2 py-1 rounded ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                            Attempts: {userAttempts}/{maxAttempts}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                    {/* Title */}
                    <div>
                        <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {question.title}
                        </h4>
                    </div>

                    {/* Description */}
                    <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: colors.text }}>
                            <HelpCircle size={14} />
                            Description
                        </h4>
                        <div 
                            className={`text-sm whitespace-pre-wrap p-3 rounded border ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                            style={{ 
                                backgroundColor: theme === 'light' ? '#f8f9fa' : '#2d2d2d',
                                borderColor: colors.border
                            }}
                        >
                            {question.description}
                        </div>
                    </div>

                    {/* Example */}
                    {question.example && (
                        <div>
                            <button
                                onClick={() => setShowExample(!showExample)}
                                className={`flex items-center gap-2 w-full p-2 rounded text-sm ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                            >
                                <Code size={14} className={theme === 'dark' ? 'text-purple-400' : 'text-purple-600'} />
                                <span className={`font-medium ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                                    Example {showExample ? '▼' : '▶'}
                                </span>
                            </button>
                            {showExample && (
                                <div className={`mt-1 p-3 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-purple-50 border-purple-200'}`}>
                                    <pre className="whitespace-pre-wrap font-mono text-xs" style={{ color: theme === 'dark' ? '#cccccc' : '#333333' }}>
                                        {question.example}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Hint */}
                    {question.hint && (
                        <div>
                            <button
                                onClick={() => setShowHint(!showHint)}
                                className={`flex items-center gap-2 w-full p-2 rounded text-sm ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                            >
                                <HelpCircle size={14} className={theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'} />
                                <span className={`font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
                                    Hint {showHint ? '▼' : '▶'}
                                </span>
                            </button>
                            {showHint && (
                                <div className={`mt-1 p-3 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                                    <p className="text-xs whitespace-pre-wrap">{question.hint}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Solution */}
                    {question.solution && (
                        <div>
                            <button
                                onClick={() => setShowSolution(!showSolution)}
                                className={`flex items-center gap-2 w-full p-2 rounded text-sm ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                            >
                                <CheckCircle size={14} className={theme === 'dark' ? 'text-green-400' : 'text-green-600'} />
                                <span className={`font-medium ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                                    Solution {showSolution ? '▼' : '▶'}
                                </span>
                            </button>
                            {showSolution && (
                                <div className={`mt-1 p-3 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-green-50 border-green-200'}`}>
                                    <pre className="whitespace-pre-wrap font-mono text-xs" style={{ color: theme === 'dark' ? '#cccccc' : '#333333' }}>
                                        {question.solution}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Expected Result */}
                    {question.expectedResult && (
                        <div className={`p-3 rounded border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-blue-50 border-blue-200'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Target size={12} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
                                <span className={`text-xs font-medium ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                                    Expected Result
                                </span>
                            </div>
                            <p className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-blue-700'}`}>
                                {question.expectedResult}
                            </p>
                        </div>
                    )}

                    {/* Constraints */}
                    {question.constraints && question.constraints.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium mb-2" style={{ color: colors.text }}>
                                Requirements
                            </h4>
                            <ul className="space-y-1">
                                {question.constraints.map((constraint: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: colors.text }}>
                                        <span className="text-green-500 mt-0.5">•</span>
                                        <span>{constraint}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Tips Section */}
                 
                </div>
            </div>

            {/* Footer */}
            <div className={`p-3 border-t text-xs ${theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Q{currentQuestionIndex + 1} of {totalQuestions}
                    </span>
                    <span className={`px-2 py-1 rounded ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800'}`}>
                        SQL Question
                    </span>
                </div>
            </div>
        </div>
    )
}

// Database Navigator Component
const DatabaseNavigator = ({
    databases,
    currentDatabase,
    onSelectDatabase,
    onSelectTable,
    onCreateDatabase,
    onRefresh,
    theme = "light"
}: {
    databases: BrowserDatabase[]
    currentDatabase: BrowserDatabase | null
    onSelectDatabase: (name: string) => void
    onSelectTable: (tableName: string) => void
    onCreateDatabase: () => void
    onRefresh: () => void
    theme?: "light" | "dark"
}) => {
    const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(new Set())
    const [searchTerm, setSearchTerm] = useState('')

    const toggleDatabase = (name: string) => {
        setExpandedDatabases(prev => {
            const newSet = new Set(prev)
            if (newSet.has(name)) {
                newSet.delete(name)
            } else {
                newSet.add(name)
            }
            return newSet
        })
    }

    const filteredDatabases = databases.filter(db =>
        searchTerm ? db.name.toLowerCase().includes(searchTerm.toLowerCase()) : true
    )

    return (
        <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <div className={`p-3 border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                        Database Navigator
                    </h3>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onRefresh}
                            className={`p-1.5 rounded hover:scale-105 transition-all ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}
                            title="Refresh"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={onCreateDatabase}
                            className={`p-1.5 rounded hover:scale-105 transition-all ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}
                            title="New Database"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                <div className="relative">
                    <Search className={`absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                    <input
                        type="text"
                        placeholder="Search databases..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full pl-8 pr-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all ${theme === 'dark'
                            ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500'
                            : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500'
                            }`}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {filteredDatabases.length === 0 ? (
                    <div className="text-center py-4">
                        <Database className={`w-8 h-8 mx-auto mb-2 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                            No databases found
                        </p>
                    </div>
                ) : (
                    filteredDatabases.map(db => (
                        <div key={db.name} className="mb-1">
                            <button
                                onClick={() => toggleDatabase(db.name)}
                                className={`w-full flex items-center justify-between p-2 rounded text-left hover:scale-[1.02] transition-all ${theme === 'dark'
                                    ? 'hover:bg-gray-800 text-gray-300'
                                    : 'hover:bg-gray-100 text-gray-700'
                                    } ${currentDatabase?.name === db.name
                                        ? (theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50')
                                        : ''}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Database className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
                                    <span className="text-sm font-medium">{db.name}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                                        {db.tables.length}
                                    </span>
                                </div>
                                {expandedDatabases.has(db.name) ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                    <ChevronRightIcon className="w-3.5 h-3.5" />
                                )}
                            </button>

                            {expandedDatabases.has(db.name) && (
                                <div className="ml-6 mt-1 space-y-1">
                                    <div className="mb-2">
                                        <div className={`text-xs font-medium px-2 py-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Tables
                                        </div>
                                        {db.tables.map(table => (
                                            <button
                                                key={table.name}
                                                onClick={() => {
                                                    onSelectDatabase(db.name)
                                                    onSelectTable(table.name)
                                                }}
                                                className={`w-full flex items-center gap-2 p-1.5 pl-4 rounded text-sm hover:scale-[1.01] transition-all ${theme === 'dark'
                                                    ? 'hover:bg-gray-800 text-gray-400'
                                                    : 'hover:bg-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                <Table className="w-3 h-3" />
                                                <span>{table.name}</span>
                                                <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    ({table.data.length})
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className={`p-2 border-t ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between text-xs">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {databases.length} databases
                    </span>
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {databases.reduce((sum, db) => sum + db.tables.length, 0)} tables
                    </span>
                </div>
            </div>
        </div>
    )
}

const QueryTabManager = ({
    tabs,
    activeTab,
    onTabClick,
    onNewTab,
    onCloseTab,
    onRenameTab,
    theme = "light"
}: {
    tabs: QueryTab[]
    activeTab: string
    onTabClick: (tabId: string) => void
    onNewTab: () => void
    onCloseTab: (tabId: string) => void
    onRenameTab: (tabId: string, name: string) => void
    theme?: "light" | "dark"
}) => {
    const [renamingTab, setRenamingTab] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')

    const handleRename = (tabId: string, currentName: string) => {
        setRenamingTab(tabId)
        setRenameValue(currentName)
    }

    const saveRename = (tabId: string) => {
        if (renameValue.trim()) {
            onRenameTab(tabId, renameValue.trim())
        }
        setRenamingTab(null)
    }

    return (
        <div className={`flex items-center border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-100'}`}>
            <div className="flex items-center flex-1 overflow-x-auto">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        className={`flex items-center border-r transition-all ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'} ${activeTab === tab.id
                            ? theme === 'dark'
                                ? 'bg-gray-900 text-white'
                                : 'bg-white text-gray-900'
                            : theme === 'dark'
                                ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        <button
                            onClick={() => onTabClick(tab.id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm min-w-[120px] max-w-[200px] hover:scale-[1.02] transition-all"
                        >
                            {tab.isDirty && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>}
                            {renamingTab === tab.id ? (
                                <input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={() => saveRename(tab.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveRename(tab.id)
                                        if (e.key === 'Escape') setRenamingTab(null)
                                    }}
                                    className={`bg-transparent border-none outline-none w-full ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        }`}
                                    autoFocus
                                />
                            ) : (
                                <span
                                    className="truncate"
                                    onDoubleClick={() => handleRename(tab.id, tab.name)}
                                >
                                    {tab.name}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => onCloseTab(tab.id)}
                            className={`p-1 rounded mr-1 hover:scale-110 transition-all ${theme === 'dark'
                                ? 'hover:bg-gray-700 text-gray-400'
                                : 'hover:bg-gray-300 text-gray-600'
                                }`}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>
            <button
                onClick={onNewTab}
                className={`p-2 hover:scale-110 transition-all ${theme === 'dark'
                    ? 'hover:bg-gray-700 text-gray-400'
                    : 'hover:bg-gray-200 text-gray-600'
                    }`}
                title="New Query Tab"
            >
                <Plus className="w-4 h-4" />
            </button>
        </div>
    )
}

const EnhancedResultViewer = ({
    result,
    theme = "light"
}: {
    result: ExecutionResult | null
    theme?: "light" | "dark"
}) => {
    const [viewMode, setViewMode] = useState<'table' | 'json' | 'text'>('table')

    if (!result) {
        return (
            <div className={`h-full flex flex-col items-center justify-center p-8 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
                <Table className={`w-12 h-12 mb-4 ${theme === 'dark' ? 'text-gray-700' : 'text-gray-300'}`} />
                <h3 className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    No Query Results
                </h3>
                <p className={`text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                    Run a SQL query to see results here
                </p>
            </div>
        )
    }

    if (!result.success) {
        return (
            <div className={`h-full p-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
                <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'border-red-800 bg-red-900/20' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className={`w-5 h-5 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
                        <span className={`font-medium ${theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>
                            Query Error
                        </span>
                    </div>
                    <pre className={`font-mono text-sm whitespace-pre-wrap ${theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>
                        {result.error}
                    </pre>
                </div>
            </div>
        )
    }

    return (
        <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <div className={`flex items-center justify-between p-3 border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center gap-4">
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                        Results
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-2 py-1 text-xs rounded hover:scale-105 transition-all ${viewMode === 'table'
                                ? theme === 'dark'
                                    ? 'bg-blue-900/50 text-blue-300'
                                    : 'bg-blue-100 text-blue-700'
                                : theme === 'dark'
                                    ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            Table
                        </button>
                        <button
                            onClick={() => setViewMode('json')}
                            className={`px-2 py-1 text-xs rounded hover:scale-105 transition-all ${viewMode === 'json'
                                ? theme === 'dark'
                                    ? 'bg-blue-900/50 text-blue-300'
                                    : 'bg-blue-100 text-blue-700'
                                : theme === 'dark'
                                    ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            JSON
                        </button>
                        <button
                            onClick={() => setViewMode('text')}
                            className={`px-2 py-1 text-xs rounded hover:scale-105 transition-all ${viewMode === 'text'
                                ? theme === 'dark'
                                    ? 'bg-blue-900/50 text-blue-300'
                                    : 'bg-blue-100 text-blue-700'
                                : theme === 'dark'
                                    ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                }`}
                        >
                            Text
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {result.executionTime && (
                        <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            {result.executionTime.toFixed(2)} ms
                        </span>
                    )}
                    {result.rowCount !== undefined && (
                        <span className={`text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                            {result.rowCount} rows
                        </span>
                    )}
                    {result.affectedRows !== undefined && result.affectedRows > 0 && (
                        <span className={`text-xs ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                            {result.affectedRows} affected
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                {viewMode === 'table' && result.resultSet && result.columns ? (
                    <div className="overflow-x-auto">
                        <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                            <thead className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}>
                                <tr>
                                    {result.columns.map((col, idx) => (
                                        <th
                                            key={idx}
                                            className={`px-4 py-2 text-left text-xs font-semibold uppercase ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                                }`}
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className={theme === 'dark' ? 'divide-gray-800' : 'divide-gray-200'}>
                                {result.resultSet.slice(0, 100).map((row, rowIdx) => (
                                    <tr
                                        key={rowIdx}
                                        className={theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}
                                    >
                                        {result.columns!.map((col, colIdx) => (
                                            <td
                                                key={colIdx}
                                                className={`px-4 py-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                                    }`}
                                            >
                                                {row[col] === null ? (
                                                    <span className="italic text-gray-400">NULL</span>
                                                ) : typeof row[col] === 'object' ? (
                                                    <span className="text-gray-400">[Object]</span>
                                                ) : (
                                                    String(row[col])
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {result.resultSet.length > 100 && (
                            <div className={`text-xs p-2 text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                                Showing 100 of {result.resultSet.length} rows
                            </div>
                        )}
                    </div>
                ) : viewMode === 'json' && result.resultSet ? (
                    <pre className={`font-mono text-sm p-4 rounded ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-800'}`}>
                        {JSON.stringify(result.resultSet.slice(0, 50), null, 2)}
                    </pre>
                ) : viewMode === 'text' ? (
                    <div className="p-4">
                        <div className={`p-4 rounded ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-800'}`}>
                            <div className="font-mono text-sm whitespace-pre-wrap">{result.output}</div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className={theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}>
                            No data to display
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

const QueryHistoryPanel = ({
    history,
    onSelectQuery,
    onClearHistory,
    theme = "light"
}: {
    history: QueryHistoryItem[]
    onSelectQuery: (query: string) => void
    onClearHistory: () => void
    theme?: "light" | "dark"
}) => {
    const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all')

    const filteredHistory = history.filter(item => {
        if (filter === 'success') return item.success
        if (filter === 'error') return !item.success
        return true
    })

    return (
        <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <div className={`p-3 border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                        Query History
                    </h3>
                    <div className="flex items-center gap-2">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className={`text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all ${theme === 'dark'
                                ? 'border-gray-600 bg-gray-700 text-gray-300 focus:border-blue-500'
                                : 'border-gray-300 bg-white text-gray-900 focus:border-blue-500'
                                }`}
                        >
                            <option value="all">All</option>
                            <option value="success">Success</option>
                            <option value="error">Error</option>
                        </select>
                        <button
                            onClick={onClearHistory}
                            className={`text-xs px-2 py-1 rounded hover:scale-105 transition-all ${theme === 'dark'
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                }`}
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {filteredHistory.length === 0 ? (
                    <div className="text-center py-8">
                        <History className={`w-8 h-8 mx-auto mb-2 ${theme === 'dark' ? 'text-gray-700' : 'text-gray-300'}`} />
                        <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                            No query history
                        </p>
                    </div>
                ) : (
                    filteredHistory.map((item) => (
                        <div
                            key={item.id}
                            className={`mb-2 p-3 rounded cursor-pointer hover:scale-[1.01] transition-all ${theme === 'dark'
                                ? 'hover:bg-gray-800'
                                : 'hover:bg-gray-100'
                                } ${item.success
                                    ? (theme === 'dark' ? 'border-l-4 border-green-500' : 'border-l-4 border-green-400')
                                    : (theme === 'dark' ? 'border-l-4 border-red-500' : 'border-l-4 border-red-400')
                                }`}
                            onClick={() => onSelectQuery(item.query)}
                        >
                            <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    {item.success ? (
                                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                    ) : (
                                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                                    )}
                                    <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {item.timestamp.toLocaleTimeString()}
                                    </span>
                                </div>
                                <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {item.executionTime.toFixed(2)}ms
                                </span>
                            </div>
                            <pre className={`text-xs font-mono whitespace-pre-wrap truncate ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                {item.query}
                            </pre>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

// Main Component - Updated with proper sidebar like FrontendQuestion
export default function SqlEditor({
    initialQuery = `-- Write your SQL query here\n-- Example: SELECT * FROM employees;`,
    theme = "light",
    showSubmitButton = true,
    submitLabel = "Submit Answer",
    showDatabaseControls = true,
    readOnly = false,
    onQueryChange,
    onQueryRun,
    onSubmit,
    
    // Question-related props
    question,
    currentQuestionIndex = 0,
    totalQuestions = 1,
    userAttempts = 0,
    maxAttempts = 3,
    attemptLimitEnabled = false,
    
    // New props for exercise functionality
    exercise,
    defaultQuestions = [],
    courseId = "",
    nodeId = "",
    nodeName = "",
    nodeType = "",
    subcategory = "",
    category = "We_Do",
    studentId = "unknown_student",
    onBack,
    onCloseExercise,
    onResetExercise,
    initialQuestionIdx = 0,
    registerSubmit
}: SqlEditorProps) {
    const [currentTheme, setCurrentTheme] = useState<string>(theme)
    const [databases, setDatabases] = useState<BrowserDatabase[]>([])
    const [currentDatabase, setCurrentDatabase] = useState<BrowserDatabase | null>(null)
    const [queryTabs, setQueryTabs] = useState<QueryTab[]>([
        {
            id: 'tab-1',
            name: 'Query 1',
            query: initialQuery,
            isDirty: false
        }
    ])
    const [activeTab, setActiveTab] = useState('tab-1')
    const [queryResults, setQueryResults] = useState<Record<string, ExecutionResult>>({})
    const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const [showQuestionSidebar, setShowQuestionSidebar] = useState(true) // Collapsible sidebar like FrontendQuestion
    const [showDatabaseSidebar, setShowDatabaseSidebar] = useState(true) // Database navigator sidebar
    const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal')
    const [toasts, setToasts] = useState<ToastNotification[]>([])

    const editorRefs = useRef<Record<string, any>>({})
    const containerRef = useRef<HTMLDivElement>(null)

    // Apply theme class to document
    useEffect(() => {
        if (currentTheme === 'dark') {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [currentTheme])

    // Initialize
    useEffect(() => {
        loadInitialData()
    }, [])

    const loadInitialData = () => {
        const loadedDatabases = EnhancedDatabaseManager.getDatabases()
        setDatabases(loadedDatabases)

        EnhancedDatabaseManager.initCurrentDatabase()
        const currentDbName = EnhancedDatabaseManager.getCurrentDatabase()
        const currentDb = loadedDatabases.find(db => db.name === currentDbName) || loadedDatabases[0]
        setCurrentDatabase(currentDb)

        setQueryHistory(EnhancedDatabaseManager.getQueryHistory())
    }

    const showToast = (notification: Omit<ToastNotification, 'id'>) => {
        const id = Date.now().toString()
        const newToast = { ...notification, id }
        setToasts(prev => [newToast, ...prev.slice(0, 5)])
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id))
        }, notification.duration)
    }

    const handleCreateDatabase = () => {
        const name = prompt('Enter database name:')
        if (name && name.trim()) {
            const newDb: BrowserDatabase = {
                name: name.trim(),
                tables: [],
                createdAt: new Date(),
                lastModified: new Date(),
                version: 1
            }
            const updated = [...databases, newDb]
            setDatabases(updated)
            EnhancedDatabaseManager.saveDatabases(updated)
            setCurrentDatabase(newDb)
            EnhancedDatabaseManager.setCurrentDatabase(newDb.name)
            showToast({
                type: 'success',
                title: 'Database Created',
                message: `Database "${name}" created successfully`,
                duration: 3000
            })
        }
    }

    const handleNewTab = () => {
        const newId = `tab-${Date.now()}`
        const newTab: QueryTab = {
            id: newId,
            name: `Query ${queryTabs.length + 1}`,
            query: '',
            isDirty: false
        }
        setQueryTabs([...queryTabs, newTab])
        setActiveTab(newId)
    }

    const handleCloseTab = (tabId: string) => {
        if (queryTabs.length === 1) return

        const tab = queryTabs.find(t => t.id === tabId)
        if (tab?.isDirty && !confirm('Close unsaved query?')) return

        const updated = queryTabs.filter(t => t.id !== tabId)
        setQueryTabs(updated)
        if (activeTab === tabId) {
            setActiveTab(updated[0].id)
        }
    }

    const handleRenameTab = (tabId: string, name: string) => {
        setQueryTabs(tabs =>
            tabs.map(tab =>
                tab.id === tabId ? { ...tab, name } : tab
            )
        )
    }

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId)
    }

    const handleQueryChange = (tabId: string, query: string) => {
        setQueryTabs(tabs =>
            tabs.map(tab =>
                tab.id === tabId ? { ...tab, query, isDirty: true } : tab
            )
        )
        
        // Call the parent onQueryChange if provided
        if (onQueryChange && tabId === activeTab) {
            onQueryChange(query)
        }
    }

    const runQuery = async () => {
        const tab = queryTabs.find(t => t.id === activeTab)
        if (!tab || !tab.query.trim()) {
            showToast({
                type: 'warning',
                title: 'Empty Query',
                message: 'Please write a SQL query first',
                duration: 3000
            })
            return
        }

        setIsRunning(true)

        try {
            const result = await EnhancedDatabaseManager.executeQuery(tab.query)

            setQueryResults(prev => ({
                ...prev,
                [activeTab]: result
            }))

            setQueryTabs(tabs =>
                tabs.map(t =>
                    t.id === activeTab ? { ...t, isDirty: false, result } : t
                )
            )

            const newHistory = EnhancedDatabaseManager.getQueryHistory()
            setQueryHistory(newHistory)

            const loadedDatabases = EnhancedDatabaseManager.getDatabases()
            setDatabases(loadedDatabases)

            const currentDbName = EnhancedDatabaseManager.getCurrentDatabase()
            const currentDb = loadedDatabases.find(db => db.name === currentDbName)
            if (currentDb) {
                setCurrentDatabase(currentDb)
            }

            // Call parent onQueryRun if provided
            if (onQueryRun) {
                onQueryRun(result)
            }

            if (result.success) {
                showToast({
                    type: 'success',
                    title: 'Query Executed',
                    message: result.output?.split('\n')[0] || 'Query completed successfully',
                    duration: 3000
                })
            } else {
                showToast({
                    type: 'error',
                    title: 'Query Failed',
                    message: result.error || 'Unknown error',
                    duration: 5000
                })
            }

        } catch (error) {
            showToast({
                type: 'error',
                title: 'Execution Error',
                message: error instanceof Error ? error.message : 'Unknown error',
                duration: 5000
            })
        } finally {
            setIsRunning(false)
        }
    }

    const runAllQueries = async () => {
        setIsRunning(true)
        try {
            for (const tab of queryTabs) {
                if (tab.query.trim()) {
                    setActiveTab(tab.id)
                    await new Promise(resolve => setTimeout(resolve, 100))

                    const result = await EnhancedDatabaseManager.executeQuery(tab.query)

                    setQueryResults(prev => ({
                        ...prev,
                        [tab.id]: result
                    }))

                    setQueryTabs(tabs =>
                        tabs.map(t =>
                            t.id === tab.id ? { ...t, isDirty: false, result } : t
                        )
                    )

                    await new Promise(resolve => setTimeout(resolve, 50))
                }
            }

            const newHistory = EnhancedDatabaseManager.getQueryHistory()
            setQueryHistory(newHistory)

            const loadedDatabases = EnhancedDatabaseManager.getDatabases()
            setDatabases(loadedDatabases)

            showToast({
                type: 'success',
                title: 'All Queries Executed',
                message: `Executed ${queryTabs.length} tab(s)`,
                duration: 3000
            })

        } catch (error) {
            showToast({
                type: 'error',
                title: 'Execution Error',
                message: error instanceof Error ? error.message : 'Unknown error',
                duration: 5000
            })
        } finally {
            setIsRunning(false)
        }
    }

    const clearResults = () => {
        setQueryResults({})
        showToast({
            type: 'info',
            title: 'Results Cleared',
            message: 'All query results have been cleared',
            duration: 2000
        })
    }

    const clearHistory = () => {
        EnhancedDatabaseManager.saveQueryHistory([])
        setQueryHistory([])
        showToast({
            type: 'info',
            title: 'History Cleared',
            message: 'Query history has been cleared',
            duration: 2000
        })
    }

    // Enhanced Submission Handler
    const handleSubmit = async () => {
        const tab = queryTabs.find(t => t.id === activeTab)
        if (!tab || !tab.query.trim()) {
            showToast({
                type: 'warning',
                title: 'Empty Query',
                message: 'Please write a SQL query first',
                duration: 3000
            })
            return
        }

        // If no result yet, run query first
        if (!queryResults[activeTab]) {
            showToast({
                type: 'info',
                title: 'Running Query',
                message: 'Running query before submission...',
                duration: 2000
            })
            await runQuery()
        }

        const result = queryResults[activeTab]

        // Call parent onSubmit if provided
        if (onSubmit) {
            onSubmit(tab.query, result)
        } else {
            showToast({
                type: 'success',
                title: 'Submitted',
                message: 'Query submitted successfully!',
                duration: 3000
            })
        }
    }

    // Expose submit to parent (combined page bottom-bar "Submit Question")
    useEffect(() => {
        registerSubmit?.(handleSubmit)
    })

    const handleSelectDatabase = (name: string) => {
        const db = databases.find(d => d.name === name)
        if (db) {
            setCurrentDatabase(db)
            EnhancedDatabaseManager.setCurrentDatabase(db.name)
            showToast({
                type: 'info',
                title: 'Database Selected',
                message: `Using database: ${db.name}`,
                duration: 2000
            })
        }
    }

    const handleSelectTable = (tableName: string) => {
        const tab = queryTabs.find(t => t.id === activeTab)
        if (tab && currentDatabase) {
            const newQuery = `SELECT * FROM ${tableName} LIMIT 10;`
            handleQueryChange(activeTab, tab.query + (tab.query ? '\n' : '') + newQuery)
        }
    }

    return (
        <div
            ref={containerRef}
            className={`w-full h-full flex flex-col transition-colors duration-200 ${currentTheme === 'dark'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-900'
                }`}
        >
            {/* Toast Notifications */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`flex items-start gap-3 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 ${toast.type === 'success'
                            ? 'bg-green-50 border border-green-200 text-green-800'
                            : toast.type === 'error'
                                ? 'bg-red-50 border border-red-200 text-red-800'
                                : toast.type === 'warning'
                                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                                    : 'bg-blue-50 border border-blue-200 text-blue-800'
                            }`}
                    >
                        <div className={`flex-shrink-0 ${toast.type === 'success'
                            ? 'text-green-500'
                            : toast.type === 'error'
                                ? 'text-red-500'
                                : toast.type === 'warning'
                                    ? 'text-yellow-500'
                                    : 'text-blue-500'
                            }`}>
                            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                                toast.type === 'error' ? <XCircle className="w-5 h-5" /> :
                                    toast.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
                                        <AlertTriangle className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold mb-1">{toast.title}</h4>
                            <p className="text-xs">{toast.message}</p>
                        </div>
                        <button
                            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Top Navigation Bar */}
            <div className={`flex items-center justify-between px-3 py-2 border-b transition-colors ${currentTheme === 'dark'
                ? 'border-gray-700 bg-gray-800'
                : 'border-gray-300 bg-gray-100'
                }`}>
                <div className="flex items-center gap-2">
                    {/* Question Sidebar Toggle */}
                    <button
                        onClick={() => setShowQuestionSidebar(!showQuestionSidebar)}
                        className={`p-1.5 rounded hover:scale-110 transition-all ${currentTheme === 'dark'
                            ? 'hover:bg-gray-700 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-600'
                            }`}
                        title={showQuestionSidebar ? "Hide Question Panel" : "Show Question Panel"}
                    >
                        {showQuestionSidebar ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {/* Database Sidebar Toggle */}
                    <button
                        onClick={() => setShowDatabaseSidebar(!showDatabaseSidebar)}
                        className={`p-1.5 rounded hover:scale-110 transition-all ${currentTheme === 'dark'
                            ? 'hover:bg-gray-700 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-600'
                            }`}
                        title={showDatabaseSidebar ? "Hide Database Navigator" : "Show Database Navigator"}
                    >
                        {showDatabaseSidebar ? <Database className="w-4 h-4" /> : <Database className="w-4 h-4 opacity-50" />}
                    </button>

                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`p-1.5 rounded hover:scale-110 transition-all ${currentTheme === 'dark'
                            ? 'hover:bg-gray-700 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-600'
                            }`}
                        title={showHistory ? "Hide History" : "Show History"}
                    >
                        <History className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => setLayout(layout === 'horizontal' ? 'vertical' : 'horizontal')}
                        className={`p-1.5 rounded hover:scale-110 transition-all ${currentTheme === 'dark'
                            ? 'hover:bg-gray-700 text-gray-400'
                            : 'hover:bg-gray-200 text-gray-600'
                            }`}
                        title="Toggle Layout"
                    >
                        {layout === 'horizontal' ? <SplitSquareHorizontal className="w-4 h-4" /> : <SplitSquareVertical className="w-4 h-4" />}
                    </button>

                    {/* Theme Toggle */}
                    <div className="ml-1">
                        <ThemeToggle theme={currentTheme} setTheme={setCurrentTheme} />
                    </div>

                    {showDatabaseControls && currentDatabase && (
                        <div className="flex items-center gap-2 ml-2">
                            <span className={`text-xs ${currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Database:</span>
                            <select
                                value={currentDatabase?.name || ''}
                                onChange={(e) => handleSelectDatabase(e.target.value)}
                                className={`text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all ${currentTheme === 'dark'
                                    ? 'border-gray-600 bg-gray-700 text-gray-300 focus:border-blue-500'
                                    : 'border-gray-300 bg-white text-gray-900 focus:border-blue-500'
                                    }`}
                            >
                                {databases.map(db => (
                                    <option key={db.name} value={db.name}>
                                        {db.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setQueryTabs(tabs =>
                                tabs.map(t =>
                                    t.id === activeTab ? { ...t, query: initialQuery, isDirty: false } : t
                                )
                            )
                            setQueryResults(prev => {
                                const newResults = { ...prev }
                                delete newResults[activeTab]
                                return newResults
                            })
                        }}
                        className={`px-3 py-1 text-xs rounded flex items-center gap-1 hover:scale-105 transition-all ${currentTheme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            }`}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                    </button>

                    <button
                        onClick={runQuery}
                        disabled={isRunning || readOnly}
                        className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 hover:scale-105 transition-all"
                    >
                        {isRunning ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Play className="w-3.5 h-3.5" />
                        )}
                        Run Query
                    </button>

                    <button
                        onClick={runAllQueries}
                        disabled={isRunning || readOnly}
                        className={`px-3 py-1 text-xs rounded flex items-center gap-1 hover:scale-105 transition-all ${currentTheme === 'dark'
                            ? 'bg-purple-700 hover:bg-purple-600 text-white'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <Play className="w-3.5 h-3.5" />
                        Run All
                    </button>

                    {showSubmitButton && !readOnly && (
                        <button
                            onClick={handleSubmit}
                            className="px-3 py-1 text-xs rounded bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 hover:scale-105 transition-all"
                        >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {submitLabel}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area - Three Column Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT SIDEBAR: Question Panel (Collapsible like FrontendQuestion) */}
                {showQuestionSidebar && question && (
                    <div className={`h-full flex-shrink-0 ${showQuestionSidebar ? 'w-[20%] min-w-[280px]' : 'w-12'} transition-all duration-300`}>
                        <QuestionSidebar
                            question={question}
                            currentQuestionIndex={currentQuestionIndex}
                            totalQuestions={totalQuestions}
                            userAttempts={userAttempts}
                            maxAttempts={maxAttempts}
                            attemptLimitEnabled={attemptLimitEnabled}
                            onToggleCollapse={() => setShowQuestionSidebar(!showQuestionSidebar)}
                            isCollapsed={!showQuestionSidebar}
                            theme={currentTheme}
                        />
                    </div>
                )}

                {/* MIDDLE SIDEBAR: Database Navigator */}
                {showDatabaseSidebar && showDatabaseControls && (
                    <div className={`w-64 flex-shrink-0 border-r transition-colors ${currentTheme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>
                        <DatabaseNavigator
                            databases={databases}
                            currentDatabase={currentDatabase}
                            onSelectDatabase={handleSelectDatabase}
                            onSelectTable={handleSelectTable}
                            onCreateDatabase={handleCreateDatabase}
                            onRefresh={loadInitialData}
                            theme={currentTheme}
                        />
                    </div>
                )}

                {/* MAIN EDITOR AND RESULTS AREA */}
                <div className={`flex-1 flex overflow-hidden ${!showQuestionSidebar && !showDatabaseSidebar ? 'w-full' : ''}`}>
                    <div className={`flex-1 flex ${layout === 'horizontal' ? 'flex-col' : 'flex-row'}`}>
                        <div className={`${layout === 'horizontal' ? 'h-1/2' : 'w-1/2'} flex flex-col`}>
                            <QueryTabManager
                                tabs={queryTabs}
                                activeTab={activeTab}
                                onTabClick={handleTabChange}
                                onNewTab={handleNewTab}
                                onCloseTab={handleCloseTab}
                                onRenameTab={handleRenameTab}
                                theme={currentTheme}
                            />

                            <div className="flex-1">
                                {queryTabs.map(tab => (
                                    <div
                                        key={tab.id}
                                        className={`h-full ${activeTab === tab.id ? 'block' : 'hidden'}`}
                                    >
                                        <MonacoEditor
                                            height="100%"
                                            language="sql"
                                            value={tab.query}
                                            onChange={(value) => handleQueryChange(tab.id, value || '')}
                                            onMount={(editor) => {
                                                editorRefs.current[tab.id] = editor
                                            }}
                                            theme={currentTheme === 'dark' ? 'vs-dark' : 'vs'}
                                            options={{
                                                minimap: { enabled: true },
                                                fontSize: 14,
                                                wordWrap: 'on',
                                                automaticLayout: true,
                                                suggestOnTriggerCharacters: true,
                                                quickSuggestions: true,
                                                parameterHints: { enabled: true },
                                                scrollBeyondLastLine: false,
                                                folding: true,
                                                lineNumbers: 'on',
                                                formatOnPaste: true,
                                                formatOnType: true,
                                                autoClosingBrackets: 'always',
                                                autoClosingQuotes: 'always',
                                                readOnly: readOnly
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`${layout === 'horizontal' ? 'h-1/2 border-t' : 'w-1/2 border-l'} transition-colors ${currentTheme === 'dark' ? 'border-gray-700' : 'border-gray-300'
                            }`}>
                            <EnhancedResultViewer
                                result={queryResults[activeTab]}
                                theme={currentTheme}
                            />
                        </div>
                    </div>

                    {/* RIGHT SIDEBAR: History Panel */}
                    {showHistory && showDatabaseControls && (
                        <div className="w-80 border-l flex-shrink-0 transition-colors">
                            <QueryHistoryPanel
                                history={queryHistory}
                                onSelectQuery={(query) => {
                                    const tab = queryTabs.find(t => t.id === activeTab)
                                    if (tab) {
                                        handleQueryChange(activeTab, query)
                                    }
                                }}
                                onClearHistory={clearHistory}
                                theme={currentTheme}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Status Bar */}
            <div className={`px-3 py-1.5 border-t text-xs flex items-center justify-between transition-colors ${currentTheme === 'dark'
                ? 'border-gray-700 bg-gray-800 text-gray-400'
                : 'border-gray-300 bg-gray-100 text-gray-600'
                }`}>
                <div className="flex items-center gap-4">
                    <span>{isRunning ? 'Executing...' : 'Ready'}</span>
                    {currentDatabase && (
                        <span>Database: {currentDatabase.name} ({currentDatabase.tables.length} tables)</span>
                    )}
                    <span>Tab: {queryTabs.find(t => t.id === activeTab)?.name}</span>
                    <span>Total Tabs: {queryTabs.length}</span>
                    {question && (
                        <span>Q{currentQuestionIndex + 1}/{totalQuestions}</span>
                    )}
                    {/* SIDEBAR STATUS INDICATORS */}
                    <span className={`${!showQuestionSidebar ? 'text-yellow-600 font-medium' : 'text-green-600'}`}>
                        Question: {showQuestionSidebar ? 'Visible' : 'Hidden'}
                    </span>
                    <span className={`${!showDatabaseSidebar ? 'text-yellow-600 font-medium' : 'text-blue-600'}`}>
                        Database: {showDatabaseSidebar ? 'Visible' : 'Hidden'}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <span>Query History: {queryHistory.length} items</span>
                    <span>Layout: {layout === 'horizontal' ? 'Horizontal' : 'Vertical'}</span>
                    {question && attemptLimitEnabled && (
                        <span>Attempts: {userAttempts}/{maxAttempts}</span>
                    )}
                </div>
            </div>
        </div>
    )
}