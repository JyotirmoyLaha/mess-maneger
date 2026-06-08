import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors, Shadows } from './Theme';
import {
  History,
  Calendar,
  CalendarDays,
  ShoppingBag,
  Clock,
  User,
  Edit2,
  Trash2,
  Download,
  ClipboardList,
} from 'lucide-react-native';

export default function ExpenseHistory({
  expenses = [],
  viewMode = 'daily',
  currentUser = null,
  isAdmin = false,
  onSetViewMode,
  onEditExpense,
  onDeleteExpense,
}) {
  const canModifyExpense = (expense) => {
    if (!expense || !currentUser) return false;
    if (isAdmin) return true;
    return expense.userId === currentUser.uid;
  };

  const handleDeletePress = (expense) => {
    if (!canModifyExpense(expense)) {
      Alert.alert('Permission Denied', 'You can only delete your own entries.');
      return;
    }
    Alert.alert(
      'Delete Item?',
      `Are you sure you want to delete "${expense.item}"? This action cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteExpense(expense.id),
        },
      ]
    );
  };

  const handleEditPress = (expense) => {
    if (!canModifyExpense(expense)) {
      Alert.alert('Permission Denied', 'You can only edit your own entries.');
      return;
    }
    onEditExpense(expense);
  };

  // Grouping logic
  const grouped = {};
  const keys = [];

  expenses.forEach((ex) => {
    const d = new Date(ex.date);
    let key, label;
    if (viewMode === 'daily') {
      key = d.toDateString();
      label = d.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } else {
      key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      label = d.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    }

    if (!grouped[key]) {
      grouped[key] = {
        label: label,
        total: 0,
        items: [],
        sortTime: d.getTime(),
      };
      keys.push(key);
    }
    grouped[key].items.push(ex);
    grouped[key].total += ex.cost;
  });

  // Sort groups chronologically descending
  keys.sort((a, b) => grouped[b].sortTime - grouped[a].sortTime);

  // PDF Generation Logic (Same 2 Same styling as original jsPDF reports)
  const generatePdfReport = async (key, group) => {
    try {
      const itemsHtml = [...group.items]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((item, idx) => {
          const dateStr = new Date(item.date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
          });
          const timeStr = new Date(item.date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          
          return `
            <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-size: 11px; text-align: right; color: #94a3b8; width: 25px;">${idx + 1}</td>
              ${viewMode === 'monthly' ? `<td style="padding: 10px; font-size: 12px; color: #64748b; width: 60px;">${dateStr}</td>` : ''}
              <td style="padding: 10px; font-size: 12px; font-weight: bold; color: #0f172a;">${item.item}</td>
              <td style="padding: 10px; font-size: 12px; color: #475569;">${item.addedBy}</td>
              ${viewMode === 'daily' ? `<td style="padding: 10px; font-size: 12px; color: #64748b; width: 65px;">${timeStr}</td>` : ''}
              <td style="padding: 10px; font-size: 12px; font-weight: bold; color: #059669; text-align: right; width: 85px;">₹${item.cost.toLocaleString('en-IN')}</td>
            </tr>
          `;
        })
        .join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              margin: 36pt;
              color: #1e293b;
            }
            .header-band {
              background-color: #0f172a;
              color: #ffffff;
              padding: 24px 36px;
              border-bottom: 3px solid #10b981;
              margin: -36pt -36pt 20px -36pt;
            }
            .header-band h1 {
              margin: 0 0 8px 0;
              font-size: 24px;
              font-weight: bold;
            }
            .header-band .sub {
              font-size: 12px;
              color: #a7f3d0;
            }
            .info-strip {
              background-color: #f1f5f9;
              padding: 10px 16px;
              margin-bottom: 20px;
              font-size: 11px;
              color: #475569;
              border-radius: 6px;
              display: flex;
              justify-content: space-between;
              font-weight: 500;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th {
              background-color: #0f172a;
              color: #a7f3d0;
              padding: 12px 10px;
              font-size: 11px;
              font-weight: bold;
              text-align: left;
              text-transform: uppercase;
            }
            .summary-card {
              background-color: ${viewMode === 'daily' ? '#10b981' : '#0d9488'};
              color: #ffffff;
              border-radius: 8px;
              padding: 16px 20px;
              width: 200px;
              float: right;
              text-align: left;
            }
            .summary-card .label {
              font-size: 10px;
              font-weight: bold;
              opacity: 0.8;
              margin-bottom: 6px;
              letter-spacing: 0.5px;
            }
            .summary-card .value {
              font-size: 20px;
              font-weight: bold;
            }
            .footer {
              position: fixed;
              bottom: 18px;
              left: 36pt;
              right: 36pt;
              font-size: 10px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="header-band">
            <div style="float: left;">
              <h1>Mess Manager</h1>
              <div class="sub">${group.label}</div>
            </div>
            <div style="float: right; text-align: right;">
              <h2 style="margin: 0 0 6px 0; font-size: 14px; text-transform: uppercase;">${viewMode} Expense Report</h2>
              <div style="font-size: 10px; color: #cbd5e1;">Generated by Mobile App</div>
            </div>
            <div style="clear: both;"></div>
          </div>

          <div class="info-strip">
            <span>${group.items.length} expense${group.items.length !== 1 ? 's' : ''} logged</span>
            <span style="float: right; font-weight: bold; color: #059669;">Total: ₹${group.total.toLocaleString('en-IN')}</span>
            <div style="clear: both;"></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: right; width: 25px;">#</th>
                ${viewMode === 'monthly' ? '<th style="width: 60px;">Date</th>' : ''}
                <th>Item</th>
                <th>Added By</th>
                ${viewMode === 'daily' ? '<th style="width: 65px;">Time</th>' : ''}
                <th style="text-align: right; width: 85px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="summary-card">
            <div class="label">TOTAL FOR THE ${viewMode.toUpperCase()}</div>
            <div class="value">₹${group.total.toLocaleString('en-IN')}</div>
          </div>

          <div class="footer">
            <span>Mess Manager &middot; Smart Expense Report</span>
            <span>Generated on ${new Date().toLocaleDateString('en-IN')}</span>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Share ${viewMode} Report` });
    } catch (err) {
      Alert.alert('PDF Error', 'Failed to generate and share the PDF report.');
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      {/* List Header */}
      <View style={styles.listHeader}>
        <View style={styles.titleWrapper}>
          <View style={styles.iconBg}>
            <History size={16} color={Colors.emerald} />
          </View>
          <Text style={styles.sectionTitle}>Recent</Text>
        </View>

        {/* View Mode Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'daily' && styles.toggleBtnActive]}
            onPress={() => onSetViewMode('daily')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, viewMode === 'daily' && styles.toggleTextActive]}>Daily</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'monthly' && styles.toggleBtnActive]}
            onPress={() => onSetViewMode('monthly')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, viewMode === 'monthly' && styles.toggleTextActive]}>Monthly</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Empty State */}
      {expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <ClipboardList size={36} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No expenses yet</Text>
          <Text style={styles.emptySubtitle}>Start tracking by adding your first item above</Text>
        </View>
      ) : null}

      {/* Group Cards */}
      {keys.map((key) => {
        const group = grouped[key];
        return (
          <View key={key} style={styles.groupCard}>
            {/* Card Header */}
            <View style={styles.groupHeader}>
              <View style={styles.groupTitleRow}>
                <View style={styles.groupIconBg}>
                  {viewMode === 'daily' ? (
                    <Calendar size={14} color={Colors.emerald} />
                  ) : (
                    <CalendarDays size={14} color={Colors.emerald} />
                  )}
                </View>
                <Text style={styles.groupLabel}>{group.label}</Text>
              </View>

              <View style={styles.groupActions}>
                <TouchableOpacity
                  style={styles.pdfBtn}
                  onPress={() => generatePdfReport(key, group)}
                  activeOpacity={0.7}
                >
                  <Download size={10} color="#ffffff" strokeWidth={2.5} />
                  <Text style={styles.pdfText}>PDF</Text>
                </TouchableOpacity>
                <View style={styles.groupTotalBadge}>
                  <Text style={styles.groupTotalText}>Total: ₹{group.total.toLocaleString('en-IN')}</Text>
                </View>
              </View>
            </View>

            {/* Group Items */}
            <View style={styles.itemsList}>
              {group.items.map((expense) => {
                const dateObj = new Date(expense.date);
                const timeStr = dateObj.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const editable = canModifyExpense(expense);

                return (
                  <View key={expense.id} style={styles.expenseItem}>
                    <View style={styles.itemMain}>
                      <View style={styles.itemLabelRow}>
                        <View style={styles.itemIcon}>
                          <ShoppingBag size={14} color={Colors.emerald} />
                        </View>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {expense.item}
                        </Text>
                      </View>

                      {/* Metadata */}
                      <View style={styles.metadataRow}>
                        {expense.userPhoto ? (
                          <Image source={{ uri: expense.userPhoto }} style={styles.userPhoto} />
                        ) : (
                          <View style={styles.userFallback}>
                            <User size={10} color={Colors.textSecondary} />
                          </View>
                        )}
                        <Text style={styles.addedByText} numberOfLines={1}>
                          {expense.addedBy}
                        </Text>
                        <Text style={styles.dot}>•</Text>
                        <View style={styles.timeWrapper}>
                          <Clock size={10} color={Colors.textMuted} style={styles.clockIcon} />
                          <Text style={styles.timeText}>{timeStr}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Price and Action buttons */}
                    <View style={styles.itemRight}>
                      <View style={styles.costBadge}>
                        <Text style={styles.costText}>₹{expense.cost.toLocaleString('en-IN')}</Text>
                      </View>
                      
                      <View style={styles.actionsRow}>
                        {editable ? (
                          <>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.editAction]}
                              onPress={() => handleEditPress(expense)}
                            >
                              <Edit2 size={12} color={Colors.emerald} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.deleteAction]}
                              onPress={() => handleDeletePress(expense)}
                            >
                              <Trash2 size={12} color={Colors.red} />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View style={styles.readOnlyBadge}>
                            <Text style={styles.readOnlyText}>Read-only</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 6,
    borderRadius: 8,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: '#1e293b',
    ...Shadows.sm,
  },
  toggleText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  emptyState: {
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderStyle: 'dashed',
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  groupCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 16,
    ...Shadows.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupIconBg: {
    backgroundColor: '#ffffff',
    padding: 4,
    borderRadius: 6,
    ...Shadows.sm,
  },
  groupLabel: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.emerald,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    ...Shadows.sm,
  },
  pdfText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  groupTotalBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  groupTotalText: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '700',
  },
  itemsList: {
    paddingVertical: 4,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  itemMain: {
    flex: 1,
    marginRight: 10,
  },
  itemLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  itemIcon: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
    padding: 4,
    borderRadius: 6,
  },
  itemName: {
    color: '#cbd5e1', // Slate 300
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
  },
  userPhoto: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 6,
  },
  userFallback: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  addedByText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 90,
  },
  dot: {
    color: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 6,
    fontSize: 8,
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clockIcon: {
    marginRight: 4,
  },
  timeText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  itemRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  costBadge: {
    backgroundColor: Colors.emeraldLight,
    borderWidth: 1,
    borderColor: Colors.emeraldBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  costText: {
    color: Colors.emerald,
    fontSize: 17,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
    height: 22,
    alignItems: 'center',
  },
  actionBtn: {
    padding: 4,
    borderRadius: 6,
  },
  editAction: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  deleteAction: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  readOnlyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  readOnlyText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
