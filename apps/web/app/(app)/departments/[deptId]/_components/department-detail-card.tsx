"use client";

import { useState } from "react";
import Link from "next/link";
import type { Department } from "@/lib/departments/types";
import { softDeleteDepartment } from "@/lib/departments/actions";
import { DeleteConfirmModal } from "../../_components/delete-confirm-modal";

interface DepartmentDetailCardProps {
  department: Department;
  ownerName: string;
  isSuperAdmin: boolean;
}

export function DepartmentDetailCard({
  department,
  ownerName,
  isSuperAdmin,
}: DepartmentDetailCardProps) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div className="rounded-200 border border-neutral-300 bg-neutral-0 p-400">
      <div className="flex items-start justify-between gap-300">
        <div className="flex flex-col gap-100">
          <h1 className="font-display text-h1 text-neutral-950">{department.name}</h1>
          <p className="text-body text-neutral-600">
            Department Head: {ownerName}
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-200">
            <Link
              href={`/departments/${department.id}/edit`}
              className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-100 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="rounded-200 border border-semantic-error/30 bg-neutral-0 px-300 py-100 text-body-sm text-semantic-error transition-colors duration-fast hover:bg-semantic-error/10"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {showDelete && (
        <DeleteConfirmModal
          entityName={department.name}
          consequenceText="Deleting this department will also remove all its teams. This action cannot be undone."
          hiddenFields={{ id: department.id }}
          action={softDeleteDepartment}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
