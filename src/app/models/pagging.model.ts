export class PaginationModel {
    totalRows: number = 10;
    pageSizePerScroll: number = 10;
    totalRecords: number = 1;
    currentPage: number = 1;
    pageLinkSize: number = 4
  }
  export class GenericPagingListVm<T> {
    totalCount: number = 0;
    currentPageNo: number = 1;
    pageSize: number = 10;
    totalPages: number = 0;
    records: T[] | undefined;
  }
  export class PagedFilterVM<T> {
    totalCount: number = 0;
    currentPageNo: number = 1;
    pageSize: number = 10;
    totalPages: number = 0;
    filterCriteria: T | undefined;
  }