'use client'

import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DataTable<TData, TValue>({ columns, data }: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  })

  const statusFilterValue = (table.getColumn('isPublished')?.getFilterValue() as string) ?? 'all'

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Cerca corsi..."
            value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
            onChange={(event) => table.getColumn('title')?.setFilterValue(event.target.value)}
            className="w-[260px]"
          />
          <Select value={statusFilterValue} onValueChange={(v) => table.getColumn('isPublished')?.setFilterValue(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="published">Pubblicati</SelectItem>
              <SelectItem value="draft">Bozze</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Link href="/manage/create">
          <Button className="bg-[#5D62E1] text-white hover:bg-[#5055c9]">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuovo corso
          </Button>
        </Link>
      </div>

      {/* Table Container with glass effect */}
      <div className="rounded-2xl border border-white/20 bg-white/60 p-2 backdrop-blur-md supports-[backdrop-filter]:bg-white/50">
        <div className="rounded-xl border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="group odd:bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    Nessun risultato.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Pagina {table.getState().pagination.pageIndex + 1} di {table.getPageCount() || 1}
          </span>
          <span className="hidden md:inline">•</span>
          <span>{table.getRowModel().rows.length} righe visualizzate</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(table.getState().pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Elementi/pagina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 per pagina</SelectItem>
              <SelectItem value="20">20 per pagina</SelectItem>
              <SelectItem value="50">50 per pagina</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Precedente
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Successivo
          </Button>
        </div>
      </div>
    </div>
  )
}
