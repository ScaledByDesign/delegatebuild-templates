import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, RefreshCw, Lock, Search, Edit, X, Package, FolderOpen, Plus, Trash2, ChevronUp, ChevronDown, Image as ImageIcon, Video, FileText, ChevronRight, ExternalLink, ArrowRightLeft, ListOrdered } from 'lucide-react';
import { getAdminClient, setAdminToken } from '@/lib/admin/adminClient';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { getAllRedirects, createRedirect, updateRedirect, deleteRedirect, type Redirect } from '@/services/redirects';

interface Product {
  id: string;
  title: string;
  handle: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface Collection {
  id: string;
  title: string;
  handle: string;
  metadata?: Record<string, any>;
}

export default function Admin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedRedirect, setSelectedRedirect] = useState<Redirect | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminToken, setAdminTokenState] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editType, setEditType] = useState<'product' | 'collection'>('product');
  const [pdpSectionsOpen, setPdpSectionsOpen] = useState(true);
  const [contentTabOpen, setContentTabOpen] = useState(false);
  const [redirectDialogOpen, setRedirectDialogOpen] = useState(false);
  const [redirectFormData, setRedirectFormData] = useState({
    source_path: '',
    destination_path: '',
    redirect_type: 301,
    is_active: true,
    notes: ''
  });
  // Product reorder state
  const [reorderCollection, setReorderCollection] = useState<Collection | null>(null);
  const [reorderProducts, setReorderProducts] = useState<Product[]>([]);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);
  const { toast } = useToast();

  // Check if already authenticated and validate token
  useEffect(() => {
    const token = localStorage.getItem('medusa_admin_token');
    if (token) {
      setAdminTokenState(token);
      const validateToken = async () => {
        try {
          setAdminToken(token);
          const client = getAdminClient();
          await client.listProducts(1, 0);
          setAuthenticated(true);
        } catch {
          localStorage.removeItem('medusa_admin_token');
          setAdminTokenState('');
          setAuthenticated(false);
        }
      };
      validateToken();
    }
  }, []);

  const handleLogin = async () => {
    if (!adminToken.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an admin token',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      setAdminToken(adminToken);
      const client = getAdminClient();
      await client.listProducts(1, 0);
      setAuthenticated(true);
      toast({
        title: 'Success',
        description: 'Admin token validated',
      });
    } catch {
      localStorage.removeItem('medusa_admin_token');
      toast({
        title: 'Authentication Failed',
        description: 'Invalid admin token. Please check and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('medusa_admin_token');
    setAuthenticated(false);
    setAdminTokenState('');
  };

  // Fetch products
  const fetchProducts = async () => {
    setLoading(true);
    try {
      console.log('Fetching products...');
      const client = getAdminClient();
      const productsList = await client.listProducts(100, 0);
      console.log('Products fetched:', productsList.length);
      setProducts(productsList);

      if (productsList.length === 0) {
        toast({
          title: 'No Products',
          description: 'No products found in the database.',
        });
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: `Failed to fetch products: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch collections
  const fetchCollections = async () => {
    setLoading(true);
    try {
      console.log('Fetching collections...');
      const client = getAdminClient();
      const collectionsList = await client.listCollections(100, 0);
      console.log('Collections fetched:', collectionsList.length);
      setCollections(collectionsList);

      if (collectionsList.length === 0) {
        toast({
          title: 'No Collections',
          description: 'No collections found in the database.',
        });
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast({
        title: 'Error',
        description: `Failed to fetch collections: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch redirects
  const fetchRedirects = async () => {
    setLoading(true);
    try {
      console.log('Fetching redirects...');
      const redirectsList = await getAllRedirects();
      console.log('Redirects fetched:', redirectsList.length);
      setRedirects(redirectsList);
    } catch (error) {
      console.error('Error fetching redirects:', error);
      toast({
        title: 'Error',
        description: `Failed to fetch redirects: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchProducts();
      fetchCollections();
      fetchRedirects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // Save product metadata
  const saveProductMetadata = async () => {
    if (!selectedProduct) return;

    setSaving(true);
    try {
      const client = getAdminClient();
      await client.updateProduct(selectedProduct.id, {
        title: selectedProduct.title,
        description: selectedProduct.description || '',
        metadata: selectedProduct.metadata,
      });

      toast({
        title: 'Success',
        description: 'Product metadata saved successfully',
      });

      // Refresh the product list
      await fetchProducts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save product metadata',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Save collection metadata
  const saveCollectionMetadata = async () => {
    if (!selectedCollection) return;

    setSaving(true);
    try {
      const client = getAdminClient();
      await client.updateCollection(selectedCollection.id, {
        metadata: selectedCollection.metadata,
      });

      toast({
        title: 'Success',
        description: 'Collection metadata saved successfully',
      });

      // Refresh the collection list
      await fetchCollections();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save collection metadata',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Update product metadata field
  const updateProductMetadata = (key: string, value: any) => {
    if (!selectedProduct) return;
    setSelectedProduct({
      ...selectedProduct,
      metadata: {
        ...selectedProduct.metadata,
        [key]: value,
      },
    });
  };

  // PDP Sections helpers
  const addPdpSection = () => {
    if (!selectedProduct) return;
    const sections = selectedProduct.metadata?.pdp_sections || [];
    const newSection = {
      type: 'image_with_text',
      title: '',
      body_html: '',
      image: '',
      align: 'left',
    };
    updateProductMetadata('pdp_sections', [...sections, newSection]);
  };

  const removePdpSection = (index: number) => {
    if (!selectedProduct) return;
    const sections = selectedProduct.metadata?.pdp_sections || [];
    updateProductMetadata('pdp_sections', sections.filter((_, i) => i !== index));
  };

  const updatePdpSection = (index: number, field: string, value: any) => {
    if (!selectedProduct) return;
    const sections = [...(selectedProduct.metadata?.pdp_sections || [])];
    sections[index] = { ...sections[index], [field]: value };
    updateProductMetadata('pdp_sections', sections);
  };

  // FAQ Items helpers for PDP sections
  const addFaqItem = (sectionIndex: number) => {
    if (!selectedProduct) return;
    const sections = [...(selectedProduct.metadata?.pdp_sections || [])];
    const items = sections[sectionIndex].items || [];
    sections[sectionIndex] = {
      ...sections[sectionIndex],
      items: [...items, { question: '', answer: '' }],
    };
    updateProductMetadata('pdp_sections', sections);
  };

  const removeFaqItem = (sectionIndex: number, itemIndex: number) => {
    if (!selectedProduct) return;
    const sections = [...(selectedProduct.metadata?.pdp_sections || [])];
    const items = sections[sectionIndex].items || [];
    sections[sectionIndex] = {
      ...sections[sectionIndex],
      items: items.filter((_: any, i: number) => i !== itemIndex),
    };
    updateProductMetadata('pdp_sections', sections);
  };

  const updateFaqItem = (sectionIndex: number, itemIndex: number, field: string, value: string) => {
    if (!selectedProduct) return;
    const sections = [...(selectedProduct.metadata?.pdp_sections || [])];
    const items = [...(sections[sectionIndex].items || [])];
    items[itemIndex] = { ...items[itemIndex], [field]: value };
    sections[sectionIndex] = { ...sections[sectionIndex], items };
    updateProductMetadata('pdp_sections', sections);
  };

  const movePdpSection = (index: number, direction: 'up' | 'down') => {
    if (!selectedProduct) return;
    const sections = [...(selectedProduct.metadata?.pdp_sections || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
    updateProductMetadata('pdp_sections', sections);
  };

  // Update collection metadata field
  const updateCollectionMetadata = (key: string, value: any) => {
    if (!selectedCollection) return;
    setSelectedCollection({
      ...selectedCollection,
      metadata: {
        ...selectedCollection.metadata,
        [key]: value,
      },
    });
  };

  // Content management helpers
  const addFeature = () => {
    if (!selectedProduct) return;
    const content = selectedProduct.metadata?.content || {};
    const features = [...(content.features || []), { title: '', description: '', image: '', align: 'left' }];
    updateProductMetadata('content', { ...content, features });
  };

  const updateFeature = (index: number, field: string, value: any) => {
    if (!selectedProduct) return;
    const content = selectedProduct.metadata?.content || {};
    const features = [...(content.features || [])];
    features[index] = { ...features[index], [field]: value };
    updateProductMetadata('content', { ...content, features });
  };

  const removeFeature = (index: number) => {
    if (!selectedProduct) return;
    const content = selectedProduct.metadata?.content || {};
    const features = content.features || [];
    updateProductMetadata('content', { ...content, features: features.filter((_, i) => i !== index) });
  };

  const addSpec = () => {
    if (!selectedProduct) return;
    const content = selectedProduct.metadata?.content || {};
    const specs = [...(content.specList || []), { label: '', value: '' }];
    updateProductMetadata('content', { ...content, specList: specs });
  };

  const updateSpec = (index: number, field: string, value: any) => {
    if (!selectedProduct) return;
    const content = selectedProduct.metadata?.content || {};
    const specs = [...(content.specList || [])];
    specs[index] = { ...specs[index], [field]: value };
    updateProductMetadata('content', { ...content, specList: specs });
  };

  const removeSpec = (index: number) => {
    if (!selectedProduct) return;
    const content = selectedProduct.metadata?.content || {};
    const specs = content.specList || [];
    updateProductMetadata('content', { ...content, specList: specs.filter((_, i) => i !== index) });
  };

  const addValueProp = () => {
    if (!selectedProduct) return;
    const content = selectedProduct.metadata?.content || {};
    const props = [...(content.valueProps || []), { title: '', description: '' }];
    updateProductMetadata('content', { ...content, valueProps: props });
  };

  const updateValueProp = (index: number, field: string, value: any) => {
    if (!selectedProduct) return;
    const content = selectedProduct.metadata?.content || {};
    const props = [...(content.valueProps || [])];
    props[index] = { ...props[index], [field]: value };
    updateProductMetadata('content', { ...content, valueProps: props });
  };

  const removeValueProp = (index: number) => {
    if (!selectedProduct) return;
    const content = selectedProduct.metadata?.content || {};
    const props = content.valueProps || [];
    updateProductMetadata('content', { ...content, valueProps: props.filter((_, i) => i !== index) });
  };

  // Show login screen if not authenticated
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-[#176326] text-white p-3 rounded-lg">
                <Lock className="h-8 w-8" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">OmniCart Admin</CardTitle>
            <CardDescription className="text-center">
              Enter your admin token to manage products and collections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="admin_token">Admin Token</Label>
              <Input
                id="admin_token"
                type="password"
                placeholder="sk_..."
                value={adminToken}
                onChange={(e) => setAdminTokenState(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-2">
                Find your token in the <code className="bg-gray-100 px-1 py-0.5 rounded">.env</code> file under <code className="bg-gray-100 px-1 py-0.5 rounded">MEDUSA_ADMIN_TOKEN</code>
              </p>
            </div>
            <Button onClick={handleLogin} className="w-full bg-[#176326] hover:bg-[#0f4a1c]">
              Login to Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect CRUD operations
  const openRedirectDialog = (redirect?: Redirect) => {
    if (redirect) {
      setSelectedRedirect(redirect);
      setRedirectFormData({
        source_path: redirect.source_path,
        destination_path: redirect.destination_path,
        redirect_type: redirect.redirect_type,
        is_active: redirect.is_active,
        notes: redirect.notes || ''
      });
    } else {
      setSelectedRedirect(null);
      setRedirectFormData({
        source_path: '',
        destination_path: '',
        redirect_type: 301,
        is_active: true,
        notes: ''
      });
    }
    setRedirectDialogOpen(true);
  };

  const handleSaveRedirect = async () => {
    setSaving(true);
    try {
      if (selectedRedirect) {
        // Update existing redirect
        await updateRedirect(selectedRedirect.id, redirectFormData);
        toast({
          title: 'Success',
          description: 'Redirect updated successfully',
        });
      } else {
        // Create new redirect
        await createRedirect(redirectFormData);
        toast({
          title: 'Success',
          description: 'Redirect created successfully',
        });
      }
      setRedirectDialogOpen(false);
      await fetchRedirects();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to save redirect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRedirect = async (id: string) => {
    if (!confirm('Are you sure you want to delete this redirect?')) return;

    setSaving(true);
    try {
      await deleteRedirect(id);
      toast({
        title: 'Success',
        description: 'Redirect deleted successfully',
      });
      await fetchRedirects();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to delete redirect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter products and collections based on search
  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCollections = collections.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRedirects = redirects.filter(
    (r) =>
      r.source_path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.destination_path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEditDialog = (item: Product | Collection, type: 'product' | 'collection') => {
    if (type === 'product') {
      setSelectedProduct(item as Product);
      setSelectedCollection(null);
    } else {
      setSelectedCollection(item as Collection);
      setSelectedProduct(null);
    }
    setEditType(type);
    setEditDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-[#176326] text-white p-2 rounded-lg">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">OmniCart Admin</h1>
                <p className="text-sm text-gray-600">Product & Collection Metadata Manager</p>
              </div>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-3xl mb-6">
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products ({products.length})
            </TabsTrigger>
            <TabsTrigger value="collections" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Collections ({collections.length})
            </TabsTrigger>
            <TabsTrigger value="product-order" className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4" />
              Product Order
            </TabsTrigger>
            <TabsTrigger value="redirects" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Redirects ({redirects.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Products</CardTitle>
                    <CardDescription>Manage product metadata and settings</CardDescription>
                  </div>
                  <Button onClick={fetchProducts} variant="outline" size="sm" disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search products by title or handle..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Products Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Handle</TableHead>
                        <TableHead>Shopify ID</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Links</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Loading products...</p>
                          </TableCell>
                        </TableRow>
                      ) : filteredProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <p className="text-sm text-gray-500">
                              {searchQuery ? 'No products found matching your search' : 'No products available'}
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.title}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-gray-100 px-2 py-1 rounded">{product.handle}</code>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-gray-600">
                                {product.metadata?.shopify_product_id || '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {product.metadata?.shopify_vendor ? (
                                <Badge variant="secondary">{product.metadata.shopify_vendor}</Badge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <a
                                href={`${import.meta.env.VITE_OMNICART_ADMIN_URL || ''}/app/products/${product.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View in Medusa Admin"
                              >
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </a>
                              <a
                                href={`/products/${product.handle}`}
                                title="View on Storefront"
                              >
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                >
                                  <Package className="h-3 w-3" />
                                </Button>
                              </a>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(product, 'product')}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="collections" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Collections</CardTitle>
                    <CardDescription>Manage collection metadata and hero content</CardDescription>
                  </div>
                  <Button onClick={fetchCollections} variant="outline" size="sm" disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search collections by title or handle..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Collections Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Collection</TableHead>
                        <TableHead>Handle</TableHead>
                        <TableHead>Hero Title</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Loading collections...</p>
                          </TableCell>
                        </TableRow>
                      ) : filteredCollections.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <p className="text-sm text-gray-500">
                              {searchQuery ? 'No collections found matching your search' : 'No collections available'}
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCollections.map((collection) => (
                          <TableRow key={collection.id}>
                            <TableCell className="font-medium">{collection.title}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-gray-100 px-2 py-1 rounded">{collection.handle}</code>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-gray-600">
                                {collection.metadata?.hero?.title || '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(collection, 'collection')}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="product-order" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Product Order</CardTitle>
                    <CardDescription>Drag products up/down to set the "Featured" sort order on collection pages</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Collection Picker */}
                <div className="mb-6">
                  <Label className="text-sm font-medium">Select Collection</Label>
                  <Select
                    value={reorderCollection?.id || ''}
                    onValueChange={async (collectionId) => {
                      const col = collections.find(c => c.id === collectionId);
                      if (!col) return;
                      setReorderCollection(col);
                      setReorderLoading(true);
                      try {
                        const client = getAdminClient();
                        const prods = await client.listCollectionProducts(collectionId);
                        // Apply existing metadata order if present
                        const savedOrder: string[] = col.metadata?.product_order as string[] || [];
                        if (savedOrder.length > 0) {
                          const orderMap = new Map(savedOrder.map((handle, i) => [handle, i]));
                          prods.sort((a: Product, b: Product) => {
                            const aIdx = orderMap.has(a.handle) ? orderMap.get(a.handle)! : savedOrder.length + 999;
                            const bIdx = orderMap.has(b.handle) ? orderMap.get(b.handle)! : savedOrder.length + 999;
                            return aIdx - bIdx;
                          });
                        }
                        setReorderProducts(prods);
                      } catch (error) {
                        toast({
                          title: 'Error',
                          description: `Failed to fetch products for collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
                          variant: 'destructive',
                        });
                        setReorderProducts([]);
                      } finally {
                        setReorderLoading(false);
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1 max-w-md">
                      <SelectValue placeholder="Choose a collection..." />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.title} ({col.handle})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product List with reorder controls */}
                {reorderLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Loading products...</p>
                  </div>
                ) : reorderCollection && reorderProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No products found in this collection.</p>
                  </div>
                ) : reorderProducts.length > 0 ? (
                  <>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">#</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Handle</TableHead>
                            <TableHead className="text-right w-32">Reorder</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reorderProducts.map((product, index) => (
                            <TableRow key={product.id}>
                              <TableCell className="text-gray-400 font-mono text-sm">{index + 1}</TableCell>
                              <TableCell className="font-medium">{product.title}</TableCell>
                              <TableCell>
                                <code className="text-xs bg-gray-100 px-2 py-1 rounded">{product.handle}</code>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    disabled={index === 0}
                                    onClick={() => {
                                      const next = [...reorderProducts];
                                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                      setReorderProducts(next);
                                    }}
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    disabled={index === reorderProducts.length - 1}
                                    onClick={() => {
                                      const next = [...reorderProducts];
                                      [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                      setReorderProducts(next);
                                    }}
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-end mt-4">
                      <Button
                        onClick={async () => {
                          if (!reorderCollection) return;
                          setReorderSaving(true);
                          try {
                            const client = getAdminClient();
                            const orderedHandles = reorderProducts.map(p => p.handle);
                            await client.updateCollection(reorderCollection.id, {
                              metadata: {
                                ...reorderCollection.metadata,
                                product_order: orderedHandles,
                              },
                            });
                            // Update local collection metadata too
                            setReorderCollection({
                              ...reorderCollection,
                              metadata: { ...reorderCollection.metadata, product_order: orderedHandles },
                            });
                            // Refresh collections list to pick up metadata changes
                            await fetchCollections();
                            toast({
                              title: 'Success',
                              description: `Product order saved for "${reorderCollection.title}"`,
                            });
                          } catch (error) {
                            toast({
                              title: 'Error',
                              description: `Failed to save product order: ${error instanceof Error ? error.message : 'Unknown error'}`,
                              variant: 'destructive',
                            });
                          } finally {
                            setReorderSaving(false);
                          }
                        }}
                        disabled={reorderSaving}
                        className="bg-[#176326] hover:bg-[#0f4a1c]"
                      >
                        {reorderSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Product Order
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="redirects" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Redirects</CardTitle>
                    <CardDescription>Manage URL redirects for the application</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => openRedirectDialog()} variant="default" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Redirect
                    </Button>
                    <Button onClick={fetchRedirects} variant="outline" size="sm" disabled={loading}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search redirects by source or destination..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Redirects Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source Path</TableHead>
                        <TableHead>Destination Path</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Loading redirects...</p>
                          </TableCell>
                        </TableRow>
                      ) : filteredRedirects.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            <p className="text-sm text-gray-500">No redirects found</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRedirects.map((redirect) => (
                          <TableRow key={redirect.id}>
                            <TableCell className="font-mono text-sm">{redirect.source_path}</TableCell>
                            <TableCell className="font-mono text-sm max-w-md truncate" title={redirect.destination_path}>
                              {redirect.destination_path}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {redirect.redirect_type}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-1 rounded ${redirect.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {redirect.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openRedirectDialog(redirect)}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteRedirect(redirect.id)}
                                  disabled={saving}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Redirect Dialog */}
        <Dialog open={redirectDialogOpen} onOpenChange={setRedirectDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedRedirect ? 'Edit Redirect' : 'Add New Redirect'}</DialogTitle>
              <DialogDescription>
                {selectedRedirect ? 'Update the redirect details below' : 'Create a new URL redirect'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="source_path">Source Path *</Label>
                <Input
                  id="source_path"
                  placeholder="/old-path"
                  value={redirectFormData.source_path}
                  onChange={(e) => setRedirectFormData({ ...redirectFormData, source_path: e.target.value })}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">The path to redirect from (e.g., /old-page)</p>
              </div>
              <div>
                <Label htmlFor="destination_path">Destination Path *</Label>
                <Input
                  id="destination_path"
                  placeholder="/new-path or https://example.com"
                  value={redirectFormData.destination_path}
                  onChange={(e) => setRedirectFormData({ ...redirectFormData, destination_path: e.target.value })}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">The path to redirect to (can be internal or external URL)</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="redirect_type">Redirect Type</Label>
                  <select
                    id="redirect_type"
                    value={redirectFormData.redirect_type}
                    onChange={(e) => setRedirectFormData({ ...redirectFormData, redirect_type: parseInt(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  >
                    <option value={301}>301 - Permanent</option>
                    <option value={302}>302 - Temporary</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={redirectFormData.is_active}
                    onChange={(e) => setRedirectFormData({ ...redirectFormData, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this redirect..."
                  value={redirectFormData.notes}
                  onChange={(e) => setRedirectFormData({ ...redirectFormData, notes: e.target.value })}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setRedirectDialogOpen(false)} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={handleSaveRedirect}
                disabled={saving || !redirectFormData.source_path || !redirectFormData.destination_path}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Redirect
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-3">
              <DialogTitle className="text-lg">
                {editType === 'product' ? 'Edit Product Metadata' : 'Edit Collection Metadata'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {editType === 'product'
                  ? `Editing: ${selectedProduct?.title}`
                  : `Editing: ${selectedCollection?.title}`}
              </DialogDescription>
            </DialogHeader>

            {editType === 'product' && selectedProduct && (
              <div className="space-y-3 py-2">
                {/* Product Title & Description */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Product Details</Label>
                  <div>
                    <Label htmlFor="product_title" className="text-xs">Product Title</Label>
                    <Input
                      id="product_title"
                      value={selectedProduct.title || ''}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, title: e.target.value })}
                      placeholder="Product title"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="product_description" className="text-xs">Product Description (Plain Text)</Label>
                    <Textarea
                      id="product_description"
                      value={selectedProduct.description || ''}
                      onChange={(e) => setSelectedProduct({ ...selectedProduct, description: e.target.value })}
                      placeholder="Brief product description..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description_html" className="text-xs">Description HTML (Rich Text)</Label>
                    <RichTextEditor
                      value={selectedProduct.metadata?.description_html || ''}
                      onChange={(value) => updateProductMetadata('description_html', value)}
                      placeholder="Rich product description with formatting..."
                    />
                    <p className="text-xs text-gray-400 mt-1">This HTML description takes priority on the product page when set.</p>
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="shopify_product_id" className="text-xs">Shopify Product ID</Label>
                    <Input
                      id="shopify_product_id"
                      value={selectedProduct.metadata?.shopify_product_id || ''}
                      onChange={(e) => updateProductMetadata('shopify_product_id', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shopify_handle" className="text-xs">Shopify Handle</Label>
                    <Input
                      id="shopify_handle"
                      value={selectedProduct.metadata?.shopify_handle || ''}
                      onChange={(e) => updateProductMetadata('shopify_handle', e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shopify_vendor" className="text-xs">Vendor</Label>
                    <Input
                      id="shopify_vendor"
                      value={selectedProduct.metadata?.shopify_vendor || ''}
                      onChange={(e) => updateProductMetadata('shopify_vendor', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                {/* SEO Section */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">SEO Metadata</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="seo_title" className="text-xs">SEO Title</Label>
                      <Input
                        id="seo_title"
                        value={selectedProduct.metadata?.shopify_seo?.title || ''}
                        onChange={(e) => {
                          const seo = selectedProduct.metadata?.shopify_seo || {};
                          updateProductMetadata('shopify_seo', { ...seo, title: e.target.value });
                        }}
                        placeholder="Product SEO title"
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="seo_description" className="text-xs">SEO Description</Label>
                      <Input
                        id="seo_description"
                        value={selectedProduct.metadata?.shopify_seo?.description || ''}
                        onChange={(e) => {
                          const seo = selectedProduct.metadata?.shopify_seo || {};
                          updateProductMetadata('shopify_seo', { ...seo, description: e.target.value });
                        }}
                        placeholder="Product SEO description"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                {/* PDP Sections Visual Editor */}
                <Collapsible open={pdpSectionsOpen} onOpenChange={setPdpSectionsOpen}>
                  <div className="flex justify-between items-center">
                    <CollapsibleTrigger className="flex items-center gap-2 hover:underline">
                      <ChevronRight className={`h-4 w-4 transition-transform ${pdpSectionsOpen ? 'rotate-90' : ''}`} />
                      <Label className="text-sm font-semibold cursor-pointer">
                        PDP Sections ({(selectedProduct.metadata?.pdp_sections || []).length})
                      </Label>
                    </CollapsibleTrigger>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addPdpSection}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Section
                    </Button>
                  </div>

                  <CollapsibleContent className="space-y-3 mt-3">

                  {(selectedProduct.metadata?.pdp_sections || []).length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-500">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No PDP sections yet. Click "Add Section" to create one.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(selectedProduct.metadata?.pdp_sections || []).map((section: any, index: number) => (
                        <Card key={index} className="border">
                          <CardHeader className="pb-2 pt-3 px-4">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                {section.type === 'image_with_text' && <ImageIcon className="h-3 w-3 text-blue-500" />}
                                {section.type === 'video' && <Video className="h-3 w-3 text-red-500" />}
                                {section.type === 'html' && <FileText className="h-3 w-3 text-green-500" />}
                                <span className="text-xs font-medium">Section {index + 1}</span>
                              </div>
                              <div className="flex gap-0.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => movePdpSection(index, 'up')}
                                  disabled={index === 0}
                                  className="h-7 w-7 p-0"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => movePdpSection(index, 'down')}
                                  disabled={index === (selectedProduct.metadata?.pdp_sections || []).length - 1}
                                  className="h-7 w-7 p-0"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removePdpSection(index)}
                                  className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 px-4 pb-3">
                            {/* Section Type */}
                            <div>
                              <Label className="text-xs">Section Type</Label>
                              <Select
                                value={section.type}
                                onValueChange={(value) => updatePdpSection(index, 'type', value)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="image_with_text">Image with Text</SelectItem>
                                  <SelectItem value="video">Video</SelectItem>
                                  <SelectItem value="html">HTML</SelectItem>
                                  <SelectItem value="faq">FAQ</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Image with Text Fields */}
                            {section.type === 'image_with_text' && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="col-span-2">
                                  <Label className="text-xs">Title</Label>
                                  <Input
                                    value={section.title || ''}
                                    onChange={(e) => updatePdpSection(index, 'title', e.target.value)}
                                    placeholder="Feature title"
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Label className="text-xs">Description</Label>
                                  <RichTextEditor
                                    value={section.body_html || ''}
                                    onChange={(value) => updatePdpSection(index, 'body_html', value)}
                                    placeholder="Feature description..."
                                    className="text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Image URL</Label>
                                  <Input
                                    value={section.image || ''}
                                    onChange={(e) => updatePdpSection(index, 'image', e.target.value)}
                                    placeholder="https://..."
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Alignment</Label>
                                  <Select
                                    value={section.align || 'left'}
                                    onValueChange={(value) => updatePdpSection(index, 'align', value)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="left">Left</SelectItem>
                                      <SelectItem value="right">Right</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}

                            {/* Video Fields */}
                            {section.type === 'video' && (
                              <div>
                                <Label className="text-xs">Video URL (YouTube Embed)</Label>
                                <Input
                                  value={section.url || ''}
                                  onChange={(e) => updatePdpSection(index, 'url', e.target.value)}
                                  placeholder="https://www.youtube.com/embed/..."
                                  className="h-8 text-sm"
                                />
                              </div>
                            )}

                            {/* HTML Fields */}
                            {section.type === 'html' && (
                              <div>
                                <Label className="text-xs">HTML Content</Label>
                                <Textarea
                                  value={section.html || ''}
                                  onChange={(e) => updatePdpSection(index, 'html', e.target.value)}
                                  placeholder="<h3>Custom HTML...</h3>"
                                  rows={3}
                                  className="text-xs font-mono"
                                />
                              </div>
                            )}

                            {/* FAQ Fields */}
                            {section.type === 'faq' && (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs">Section Title</Label>
                                  <Input
                                    value={section.title || ''}
                                    onChange={(e) => updatePdpSection(index, 'title', e.target.value)}
                                    placeholder="Frequently Asked Questions"
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <Label className="text-xs">FAQ Items ({(section.items || []).length})</Label>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => addFaqItem(index)}
                                      className="h-6 text-xs px-2"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Q&A
                                    </Button>
                                  </div>
                                  {(section.items || []).map((item: any, itemIndex: number) => (
                                    <Card key={itemIndex} className="border border-gray-200">
                                      <CardContent className="p-3 space-y-2">
                                        <div className="flex justify-between items-start">
                                          <span className="text-xs font-medium text-gray-500">Q&A #{itemIndex + 1}</span>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => removeFaqItem(index, itemIndex)}
                                            className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        <div>
                                          <Label className="text-xs">Question</Label>
                                          <Input
                                            value={item.question || ''}
                                            onChange={(e) => updateFaqItem(index, itemIndex, 'question', e.target.value)}
                                            placeholder="What is the return policy?"
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <div>
                                          <Label className="text-xs">Answer</Label>
                                          <Textarea
                                            value={item.answer || ''}
                                            onChange={(e) => updateFaqItem(index, itemIndex, 'answer', e.target.value)}
                                            placeholder="We offer a 60-day money back guarantee..."
                                            rows={2}
                                            className="text-sm"
                                          />
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                  {(section.items || []).length === 0 && (
                                    <p className="text-xs text-gray-400 italic">No FAQ items yet. Click "Add Q&A" to add questions.</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Content Management Section */}
                <Collapsible open={contentTabOpen} onOpenChange={setContentTabOpen}>
                  <div className="flex justify-between items-center">
                    <CollapsibleTrigger className="flex items-center gap-2 hover:underline">
                      <ChevronRight className={`h-4 w-4 transition-transform ${contentTabOpen ? 'rotate-90' : ''}`} />
                      <Label className="text-sm font-semibold cursor-pointer">
                        Content (Features, Specs, Value Props)
                      </Label>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent className="space-y-4 mt-3">
                    {/* Features */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-semibold">Features ({(selectedProduct.metadata?.content?.features || []).length})</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addFeature} className="h-6 text-xs px-2">
                          <Plus className="h-3 w-3 mr-1" />
                          Add Feature
                        </Button>
                      </div>
                      {(selectedProduct.metadata?.content?.features || []).map((feature: any, index: number) => (
                        <Card key={index} className="border">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-medium text-gray-500">Feature {index + 1}</span>
                              <Button type="button" size="sm" variant="ghost" onClick={() => removeFeature(index)} className="h-5 w-5 p-0 text-red-500 hover:text-red-700">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="col-span-2">
                                <Label className="text-xs">Title</Label>
                                <Input value={feature.title || ''} onChange={(e) => updateFeature(index, 'title', e.target.value)} placeholder="Feature title" className="h-8 text-sm" />
                              </div>
                              <div className="col-span-2">
                                <Label className="text-xs">Description</Label>
                                <RichTextEditor value={feature.description || ''} onChange={(value) => updateFeature(index, 'description', value)} placeholder="Feature description..." />
                              </div>
                              <div>
                                <Label className="text-xs">Image URL</Label>
                                <Input value={feature.image || ''} onChange={(e) => updateFeature(index, 'image', e.target.value)} placeholder="https://..." className="h-8 text-sm" />
                              </div>
                              <div>
                                <Label className="text-xs">Alignment</Label>
                                <Select value={feature.align || 'left'} onValueChange={(value) => updateFeature(index, 'align', value)}>
                                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="left">Left</SelectItem>
                                    <SelectItem value="right">Right</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {(selectedProduct.metadata?.content?.features || []).length === 0 && (
                        <p className="text-xs text-gray-400 italic">No features defined. Click "Add Feature" to create one.</p>
                      )}
                    </div>

                    <Separator />

                    {/* Spec List */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-semibold">Specifications ({(selectedProduct.metadata?.content?.specList || []).length})</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addSpec} className="h-6 text-xs px-2">
                          <Plus className="h-3 w-3 mr-1" />
                          Add Spec
                        </Button>
                      </div>
                      {(selectedProduct.metadata?.content?.specList || []).map((spec: any, index: number) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input value={spec.label || ''} onChange={(e) => updateSpec(index, 'label', e.target.value)} placeholder="Label" className="h-8 text-sm flex-1" />
                          <Input value={spec.value || ''} onChange={(e) => updateSpec(index, 'value', e.target.value)} placeholder="Value" className="h-8 text-sm flex-1" />
                          <Button type="button" size="sm" variant="ghost" onClick={() => removeSpec(index)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {(selectedProduct.metadata?.content?.specList || []).length === 0 && (
                        <p className="text-xs text-gray-400 italic">No specifications defined.</p>
                      )}
                    </div>

                    <Separator />

                    {/* Value Props */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-semibold">Value Props ({(selectedProduct.metadata?.content?.valueProps || []).length})</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addValueProp} className="h-6 text-xs px-2">
                          <Plus className="h-3 w-3 mr-1" />
                          Add Value Prop
                        </Button>
                      </div>
                      {(selectedProduct.metadata?.content?.valueProps || []).map((prop: any, index: number) => (
                        <Card key={index} className="border">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-medium text-gray-500">Value Prop {index + 1}</span>
                              <Button type="button" size="sm" variant="ghost" onClick={() => removeValueProp(index)} className="h-5 w-5 p-0 text-red-500 hover:text-red-700">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div>
                              <Label className="text-xs">Title</Label>
                              <Input value={prop.title || ''} onChange={(e) => updateValueProp(index, 'title', e.target.value)} placeholder="Value prop title" className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Description</Label>
                              <Textarea value={prop.description || ''} onChange={(e) => updateValueProp(index, 'description', e.target.value)} placeholder="Value prop description..." rows={2} className="text-sm" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {(selectedProduct.metadata?.content?.valueProps || []).length === 0 && (
                        <p className="text-xs text-gray-400 italic">No value props defined.</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator className="my-3" />
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={async () => {
                      await saveProductMetadata();
                      setEditDialogOpen(false);
                    }}
                    disabled={saving}
                    className="flex-1 bg-[#176326] hover:bg-[#0f4a1c]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button onClick={() => setEditDialogOpen(false)} variant="outline">
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {editType === 'collection' && selectedCollection && (
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="hero_title">Hero Title</Label>
                  <Input
                    id="hero_title"
                    value={selectedCollection.metadata?.hero?.title || ''}
                    onChange={(e) =>
                      updateCollectionMetadata('hero', {
                        ...selectedCollection.metadata?.hero,
                        title: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="hero_subtitle">Hero Subtitle</Label>
                  <Textarea
                    id="hero_subtitle"
                    rows={3}
                    value={selectedCollection.metadata?.hero?.subtitle || ''}
                    onChange={(e) =>
                      updateCollectionMetadata('hero', {
                        ...selectedCollection.metadata?.hero,
                        subtitle: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="hero_image">Hero Image URL</Label>
                  <Input
                    id="hero_image"
                    value={selectedCollection.metadata?.hero?.image || ''}
                    onChange={(e) =>
                      updateCollectionMetadata('hero', {
                        ...selectedCollection.metadata?.hero,
                        image: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={async () => {
                      await saveCollectionMetadata();
                      setEditDialogOpen(false);
                    }}
                    disabled={saving}
                    className="flex-1 bg-[#176326] hover:bg-[#0f4a1c]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button onClick={() => setEditDialogOpen(false)} variant="outline">
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

