export interface ApiPermission {
  permissionName: string;
  permissionKey: string;
  permissionFunctionality: string[];
  icon: string;
  color: string;
  description: string;
  isActive: boolean;
  order: number;
  _id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  _id: string;
  originalRole: string;
  renameRole: string;
  roleValue: string;
  institution: string;
}

export interface User {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  phone: string;
  role: string;
  roleId: string;
  status: "active" | "inactive";
    studentType?: 'degree-program' | 'skilling'; // Add this field
  clientName?: string;
  clientId?: string;
  lastLogin: string;
  degree?: string;
  department?: string;
  semester?: string;
  section?: string;
  rollNumber?: string;
  year?: string;
  batch?: string;
  phase?: string;
  serviceModel?: string;
  serviceMappingId?: string;
}

export interface UserFormData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  roleId: string;
  status: "active" | "inactive";
  gender: "Male" | "Female";
  degree: string;
  department: string;
  semester: string;
  section?: string;
  rollNumber?: string;
  year: string;
  clientName?: string;
  clientId?: string;
  batch: string;
  phase?: string;
  // The service model chosen in Add User — identifies which service mapping (and
  // therefore which hierarchy structure) drives the rest of the form.
  serviceModel?: string;
  // The _id of the exact service mapping chosen. serviceModel is only a name and
  // a client can have several mappings sharing it (two "placement training"
  // services), so this is what pins enrolment to the ONE the user was added
  // under — without it a placement user would enrol into every placement course
  // the client runs, not just their service's.
  serviceMappingId?: string;
  studentType?: 'degree-program' | 'skilling' | ''; // '' = not chosen yet

}

export interface Column<T> {
  key: string;
  label: string;
  width: string;
  align: "left" | "center" | "right";
  renderCell?: (row: T) => React.ReactNode;
}